// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {DividendDistributor} from "../src/DividendDistributor.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {SecurityToken} from "../src/SecurityToken.sol";
import {ComplianceManager} from "../src/ComplianceManager.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract DividendDistributorTest is Test {
    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------

    DividendDistributor internal distributor;
    MockUSDC internal usdc;
    SecurityToken internal token;
    ComplianceManager internal compliance;
    IdentityRegistry internal registry;

    // -------------------------------------------------------------------------
    // Actors
    // -------------------------------------------------------------------------

    address internal oracle = makeAddr("oracle");
    address internal admin = makeAddr("admin"); // ComplianceManager owner
    address internal issuer = makeAddr("issuer"); // DEFAULT_ADMIN_ROLE on token

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory"); // not an admin

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 internal constant DEFAULT_ADMIN_ROLE = bytes32(0);

    uint256 internal constant ONE_USDC = 1e6;

    // -------------------------------------------------------------------------
    // Amounts for 3-holder happy-path scenarios
    // -------------------------------------------------------------------------

    uint256 internal constant ALICE_AMOUNT = 100 * ONE_USDC;
    uint256 internal constant BOB_AMOUNT = 60 * ONE_USDC;
    uint256 internal constant CAROL_AMOUNT = 40 * ONE_USDC;
    uint256 internal constant TOTAL_AMOUNT = ALICE_AMOUNT + BOB_AMOUNT + CAROL_AMOUNT;

    // -------------------------------------------------------------------------
    // setUp
    // -------------------------------------------------------------------------

    function setUp() public {
        // Deploy identity + compliance infrastructure
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(admin, address(registry));

        // Deploy token — issuer gets DEFAULT_ADMIN_ROLE
        token = new SecurityToken("Arkangeles Oferta Demo", "ARKDEMO", issuer, address(compliance));

        // Verify all actors in IdentityRegistry so minting/transfers don't
        // fail compliance checks (the token consults it on every _update).
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        registry.verifyAddress(carol);
        registry.verifyAddress(mallory);
        vm.stopPrank();

        // Deploy payment token and distributor
        usdc = new MockUSDC();
        distributor = new DividendDistributor();

        // Fund the issuer with enough USDC to run tests
        usdc.mint(issuer, 10_000 * ONE_USDC);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// @dev Build the canonical 3-holder arrays used across multiple tests.
    function _threeHolders()
        internal
        view
        returns (address[] memory holders, uint256[] memory amounts)
    {
        holders = new address[](3);
        holders[0] = alice;
        holders[1] = bob;
        holders[2] = carol;

        amounts = new uint256[](3);
        amounts[0] = ALICE_AMOUNT;
        amounts[1] = BOB_AMOUNT;
        amounts[2] = CAROL_AMOUNT;
    }

    /// @dev Approve distributor and declare a 3-holder dividend. Returns dividendId.
    function _declareDefault() internal returns (uint256 dividendId) {
        (address[] memory holders, uint256[] memory amounts) = _threeHolders();

        vm.startPrank(issuer);
        usdc.approve(address(distributor), TOTAL_AMOUNT);
        dividendId = distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 1. declare — happy path
    // =========================================================================

    function test_declare_HappyPath_ThreeHolders() public {
        (address[] memory holders, uint256[] memory amounts) = _threeHolders();

        vm.startPrank(issuer);
        usdc.approve(address(distributor), TOTAL_AMOUNT);

        vm.expectEmit(true, true, true, true);
        emit DividendDistributor.DividendDeclared(
            0,
            address(token),
            address(usdc),
            issuer,
            TOTAL_AMOUNT,
            3
        );

        uint256 id = distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();

        // Returned id must be 0 (first ever dividend)
        assertEq(id, 0);

        // nextDividendId incremented
        assertEq(distributor.nextDividendId(), 1);

        // Dividend metadata persisted
        (
            address storedToken,
            address storedPaymentToken,
            address declaredBy,
            uint256 totalAmount,
            uint256 totalClaimed,
            uint256 declaredAt,
            uint256 holderCount
        ) = distributor.dividends(0);

        assertEq(storedToken, address(token));
        assertEq(storedPaymentToken, address(usdc));
        assertEq(declaredBy, issuer);
        assertEq(totalAmount, TOTAL_AMOUNT);
        assertEq(totalClaimed, 0);
        assertEq(declaredAt, block.timestamp);
        assertEq(holderCount, 3);

        // Allocations stored correctly
        assertEq(distributor.allocation(0, alice), ALICE_AMOUNT);
        assertEq(distributor.allocation(0, bob), BOB_AMOUNT);
        assertEq(distributor.allocation(0, carol), CAROL_AMOUNT);

        // USDC transferred to contract
        assertEq(usdc.balanceOf(address(distributor)), TOTAL_AMOUNT);
        // Issuer balance reduced
        assertEq(usdc.balanceOf(issuer), 10_000 * ONE_USDC - TOTAL_AMOUNT);
    }

    // =========================================================================
    // 2. declare — reverts if caller is not DEFAULT_ADMIN_ROLE on token
    // =========================================================================

    function test_RevertWhen_NotIssuerAdmin() public {
        (address[] memory holders, uint256[] memory amounts) = _threeHolders();

        usdc.mint(mallory, TOTAL_AMOUNT);
        vm.startPrank(mallory);
        usdc.approve(address(distributor), TOTAL_AMOUNT);

        vm.expectRevert(
            abi.encodeWithSelector(
                DividendDistributor.NotIssuerAdmin.selector,
                address(token),
                mallory
            )
        );
        distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 3. declare — reverts on empty holder list
    // =========================================================================

    function test_RevertWhen_EmptyHolderList() public {
        address[] memory holders = new address[](0);
        uint256[] memory amounts = new uint256[](0);

        vm.startPrank(issuer);
        usdc.approve(address(distributor), 1);

        vm.expectRevert(DividendDistributor.EmptyHolderList.selector);
        distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 4. declare — reverts on array length mismatch
    // =========================================================================

    function test_RevertWhen_ArrayLengthMismatch() public {
        address[] memory holders = new address[](2);
        holders[0] = alice;
        holders[1] = bob;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * ONE_USDC;

        vm.startPrank(issuer);
        usdc.approve(address(distributor), 100 * ONE_USDC);

        vm.expectRevert(DividendDistributor.ArrayLengthMismatch.selector);
        distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 5. declare — reverts on zero address holder
    // =========================================================================

    function test_RevertWhen_ZeroAddressHolder() public {
        address[] memory holders = new address[](2);
        holders[0] = alice;
        holders[1] = address(0); // bad

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * ONE_USDC;
        amounts[1] = 50 * ONE_USDC;

        vm.startPrank(issuer);
        usdc.approve(address(distributor), 150 * ONE_USDC);

        vm.expectRevert(DividendDistributor.ZeroAddress.selector);
        distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 6. declare — reverts on zero amount
    // =========================================================================

    function test_RevertWhen_ZeroAmount() public {
        address[] memory holders = new address[](2);
        holders[0] = alice;
        holders[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * ONE_USDC;
        amounts[1] = 0; // bad

        vm.startPrank(issuer);
        usdc.approve(address(distributor), 100 * ONE_USDC);

        vm.expectRevert(DividendDistributor.ZeroAmount.selector);
        distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 7. declare — reverts on duplicate holder
    // =========================================================================

    function test_RevertWhen_DuplicateHolder() public {
        address[] memory holders = new address[](3);
        holders[0] = alice;
        holders[1] = bob;
        holders[2] = alice; // duplicate

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 * ONE_USDC;
        amounts[1] = 60 * ONE_USDC;
        amounts[2] = 40 * ONE_USDC;

        vm.startPrank(issuer);
        usdc.approve(address(distributor), 200 * ONE_USDC);

        vm.expectRevert(
            abi.encodeWithSelector(DividendDistributor.DuplicateHolder.selector, alice)
        );
        distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 8. declare — reverts if no allowance (safeTransferFrom fails)
    // =========================================================================

    function test_RevertWhen_NoAllowance() public {
        (address[] memory holders, uint256[] memory amounts) = _threeHolders();

        vm.startPrank(issuer);
        // Intentionally do NOT approve — allowance is 0.
        vm.expectRevert(); // ERC20InsufficientAllowance from OZ v5
        distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // 9. claim — happy path (3 holders, all claim, totalClaimed = totalAmount)
    // =========================================================================

    function test_claim_HappyPath_ThreeHolders() public {
        uint256 id = _declareDefault();

        // Alice claims
        vm.expectEmit(true, true, false, true);
        emit DividendDistributor.DividendClaimed(id, alice, ALICE_AMOUNT);
        vm.prank(alice);
        distributor.claim(id);
        assertEq(usdc.balanceOf(alice), ALICE_AMOUNT);

        // Bob claims
        vm.expectEmit(true, true, false, true);
        emit DividendDistributor.DividendClaimed(id, bob, BOB_AMOUNT);
        vm.prank(bob);
        distributor.claim(id);
        assertEq(usdc.balanceOf(bob), BOB_AMOUNT);

        // Carol claims
        vm.expectEmit(true, true, false, true);
        emit DividendDistributor.DividendClaimed(id, carol, CAROL_AMOUNT);
        vm.prank(carol);
        distributor.claim(id);
        assertEq(usdc.balanceOf(carol), CAROL_AMOUNT);

        // totalClaimed == totalAmount
        (, , , uint256 totalAmount, uint256 totalClaimed, , ) = distributor.dividends(id);
        assertEq(totalClaimed, TOTAL_AMOUNT);
        assertEq(totalClaimed, totalAmount);

        // Distributor balance should be 0 (all claimed)
        assertEq(usdc.balanceOf(address(distributor)), 0);

        // claimed flags all set
        assertTrue(distributor.claimed(id, alice));
        assertTrue(distributor.claimed(id, bob));
        assertTrue(distributor.claimed(id, carol));
    }

    // =========================================================================
    // 10. claim — reverts if dividend does not exist
    // =========================================================================

    function test_RevertWhen_DividendNotFound() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DividendDistributor.DividendNotFound.selector, 999));
        distributor.claim(999);
    }

    // =========================================================================
    // 11. claim — reverts if caller has no allocation
    // =========================================================================

    function test_RevertWhen_NotAllocated() public {
        uint256 id = _declareDefault();

        // mallory was never in the holders list
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(DividendDistributor.NotAllocated.selector, id, mallory)
        );
        distributor.claim(id);
    }

    // =========================================================================
    // 12. claim — reverts on double-claim (AlreadyClaimed)
    // =========================================================================

    function test_RevertWhen_AlreadyClaimed() public {
        uint256 id = _declareDefault();

        vm.prank(alice);
        distributor.claim(id);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(DividendDistributor.AlreadyClaimed.selector, id, alice)
        );
        distributor.claim(id);
    }

    // =========================================================================
    // 13. claimable view
    // =========================================================================

    function test_claimable_View() public {
        uint256 id = _declareDefault();

        // Before claim: returns allocation
        assertEq(distributor.claimable(id, alice), ALICE_AMOUNT);
        assertEq(distributor.claimable(id, bob), BOB_AMOUNT);
        assertEq(distributor.claimable(id, carol), CAROL_AMOUNT);

        // Non-allocated address: returns 0
        assertEq(distributor.claimable(id, mallory), 0);

        // After alice claims: returns 0 for her
        vm.prank(alice);
        distributor.claim(id);
        assertEq(distributor.claimable(id, alice), 0);

        // Bob and carol still show their allocation
        assertEq(distributor.claimable(id, bob), BOB_AMOUNT);
        assertEq(distributor.claimable(id, carol), CAROL_AMOUNT);

        // Non-existent dividend: returns 0
        assertEq(distributor.claimable(9999, alice), 0);
    }

    // =========================================================================
    // 14. multiple dividends for the same token — independent allocations
    // =========================================================================

    function test_MultipleDividends_IndependentAllocations() public {
        (address[] memory holders, uint256[] memory amounts) = _threeHolders();

        uint256 totalForEach = TOTAL_AMOUNT;

        vm.startPrank(issuer);
        usdc.approve(address(distributor), totalForEach * 2);

        uint256 id0 = distributor.declare(address(token), address(usdc), holders, amounts);
        uint256 id1 = distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();

        // IDs are distinct and sequential
        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(distributor.nextDividendId(), 2);

        // Allocations are independent
        assertEq(distributor.allocation(id0, alice), ALICE_AMOUNT);
        assertEq(distributor.allocation(id1, alice), ALICE_AMOUNT);

        // Claiming from id0 does not affect id1
        vm.prank(alice);
        distributor.claim(id0);

        assertTrue(distributor.claimed(id0, alice));
        assertFalse(distributor.claimed(id1, alice));
        assertEq(distributor.claimable(id1, alice), ALICE_AMOUNT);

        // totalClaimed on id0 only counts id0 claims
        (, , , , uint256 totalClaimed0, , ) = distributor.dividends(id0);
        (, , , , uint256 totalClaimed1, , ) = distributor.dividends(id1);
        assertEq(totalClaimed0, ALICE_AMOUNT);
        assertEq(totalClaimed1, 0);
    }

    // =========================================================================
    // 15. declare with a single holder — edge case
    // =========================================================================

    function test_declare_SingleHolder() public {
        address[] memory holders = new address[](1);
        holders[0] = alice;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 500 * ONE_USDC;

        vm.startPrank(issuer);
        usdc.approve(address(distributor), 500 * ONE_USDC);

        vm.expectEmit(true, true, true, true);
        emit DividendDistributor.DividendDeclared(
            0,
            address(token),
            address(usdc),
            issuer,
            500 * ONE_USDC,
            1
        );
        uint256 id = distributor.declare(address(token), address(usdc), holders, amounts);
        vm.stopPrank();

        assertEq(id, 0);
        assertEq(distributor.allocation(id, alice), 500 * ONE_USDC);

        (, , , uint256 totalAmount, , , uint256 holderCount) = distributor.dividends(id);
        assertEq(totalAmount, 500 * ONE_USDC);
        assertEq(holderCount, 1);

        // Alice can claim
        vm.prank(alice);
        distributor.claim(id);
        assertEq(usdc.balanceOf(alice), 500 * ONE_USDC);
    }

    // =========================================================================
    // Extra: declare — reverts on zero token address
    // =========================================================================

    function test_RevertWhen_ZeroTokenAddress() public {
        (address[] memory holders, uint256[] memory amounts) = _threeHolders();

        vm.startPrank(issuer);
        usdc.approve(address(distributor), TOTAL_AMOUNT);

        vm.expectRevert(DividendDistributor.ZeroAddress.selector);
        distributor.declare(address(0), address(usdc), holders, amounts);
        vm.stopPrank();
    }

    // =========================================================================
    // Extra: declare — reverts on zero paymentToken address
    // =========================================================================

    function test_RevertWhen_ZeroPaymentTokenAddress() public {
        (address[] memory holders, uint256[] memory amounts) = _threeHolders();

        vm.startPrank(issuer);
        usdc.approve(address(distributor), TOTAL_AMOUNT);

        vm.expectRevert(DividendDistributor.ZeroAddress.selector);
        distributor.declare(address(token), address(0), holders, amounts);
        vm.stopPrank();
    }
}
