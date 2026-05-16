// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Settlement} from "../src/Settlement.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {SecurityToken} from "../src/SecurityToken.sol";
import {ComplianceManager} from "../src/ComplianceManager.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract SettlementTest is Test {
    IdentityRegistry internal registry;
    ComplianceManager internal compliance;
    SecurityToken internal token;
    MockUSDC internal usdc;
    Settlement internal settlement;

    address internal admin = makeAddr("admin");
    address internal oracle = makeAddr("oracle");
    address internal issuer = makeAddr("issuer");
    address internal agent = makeAddr("agent");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal matcher = makeAddr("matcher");
    address internal mallory = makeAddr("mallory");

    address internal alice; // seller
    uint256 internal aliceKey;
    address internal bob; // buyer
    uint256 internal bobKey;

    bytes32 internal constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 internal constant MATCHER_ROLE = keccak256("MATCHER_ROLE");
    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;

    uint256 internal constant ONE_TOKEN = 1e18;
    uint256 internal constant ONE_USDC = 1e6;

    function setUp() public {
        (alice, aliceKey) = makeAddrAndKey("alice");
        (bob, bobKey) = makeAddrAndKey("bob");

        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(admin, address(registry));
        token = new SecurityToken("Arkangeles Oferta", "ARK", issuer, address(compliance));
        usdc = new MockUSDC();
        settlement = new Settlement(admin, matcher, feeRecipient, 50); // 0.50% fee

        vm.prank(issuer);
        token.grantRole(AGENT_ROLE, agent);

        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        vm.stopPrank();

        vm.prank(issuer);
        token.mint(alice, 1_000 * ONE_TOKEN);
        usdc.mint(bob, 100_000 * ONE_USDC);

        vm.prank(alice);
        token.approve(address(settlement), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(settlement), type(uint256).max);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    function _buildOrder(
        address maker,
        Settlement.Side side,
        uint256 qty,
        uint256 price,
        uint256 expiresAt,
        uint256 salt
    ) internal view returns (Settlement.Order memory) {
        return
            Settlement.Order({
                maker: maker,
                token: address(token),
                paymentToken: address(usdc),
                side: side,
                qty: qty,
                price: price,
                expiresAt: expiresAt,
                salt: salt
            });
    }

    /// @dev Memory→calldata conversion happens implicitly when calling an
    ///      external function from the test. We can pass `order` directly.
    function _sign(
        uint256 pk,
        Settlement.Order memory order,
        Settlement target
    ) internal view returns (bytes memory) {
        bytes32 digest = target.hashOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _sign(uint256 pk, Settlement.Order memory order) internal view returns (bytes memory) {
        return _sign(pk, order, settlement);
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    function test_Deployment_State() public view {
        assertTrue(settlement.hasRole(DEFAULT_ADMIN_ROLE, admin));
        assertTrue(settlement.hasRole(MATCHER_ROLE, matcher));
        assertEq(settlement.feeBps(), 50);
        assertEq(settlement.feeRecipient(), feeRecipient);
    }

    function test_Deployment_RevertsOnZeroAdmin() public {
        vm.expectRevert(Settlement.ZeroAddress.selector);
        new Settlement(address(0), matcher, feeRecipient, 50);
    }

    function test_Deployment_RevertsOnZeroMatcher() public {
        vm.expectRevert(Settlement.ZeroAddress.selector);
        new Settlement(admin, address(0), feeRecipient, 50);
    }

    function test_Deployment_RevertsOnZeroFeeRecipient() public {
        vm.expectRevert(Settlement.ZeroAddress.selector);
        new Settlement(admin, matcher, address(0), 50);
    }

    function test_Deployment_RevertsOnFeeTooHigh() public {
        vm.expectRevert(Settlement.FeeTooHigh.selector);
        new Settlement(admin, matcher, feeRecipient, 501);
    }

    // -------------------------------------------------------------------------
    // executeMatch — happy paths
    // -------------------------------------------------------------------------

    function test_ExecuteMatch_HappyPath() public {
        // Sell 100 tokens at 10 USDC/token; Buy 100 tokens at 10 USDC/token.
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            100 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            100 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(matcher);
        settlement.executeMatch(buy, buySig, sell, sellSig, 100 * ONE_TOKEN);

        assertEq(token.balanceOf(alice), 900 * ONE_TOKEN);
        assertEq(token.balanceOf(bob), 100 * ONE_TOKEN);

        // Notional = 100 * 10 = 1000 USDC. Fee = 0.50% = 5 USDC.
        assertEq(usdc.balanceOf(bob), 99_000 * ONE_USDC);
        assertEq(usdc.balanceOf(alice), 995 * ONE_USDC);
        assertEq(usdc.balanceOf(feeRecipient), 5 * ONE_USDC);
    }

    function test_ExecuteMatch_BuyerPaysAtSellersAsk_NotBuyersBid() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            10 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            10 * ONE_TOKEN,
            12 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(matcher);
        settlement.executeMatch(buy, buySig, sell, sellSig, 10 * ONE_TOKEN);

        // Execution at seller's ask (10), not buyer's bid (12). Notional = 100 USDC.
        // Fee 0.5% = 0.5 USDC; seller gets 99.5 USDC.
        assertEq(usdc.balanceOf(alice), 99_500_000);
        assertEq(usdc.balanceOf(feeRecipient), 500_000);
    }

    function test_ExecuteMatch_PartialFills_AccumulateCorrectly() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            100 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            100 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        bytes32 sellHash = settlement.hashOrder(sell);
        bytes32 buyHash = settlement.hashOrder(buy);

        vm.startPrank(matcher);
        settlement.executeMatch(buy, buySig, sell, sellSig, 40 * ONE_TOKEN);
        settlement.executeMatch(buy, buySig, sell, sellSig, 60 * ONE_TOKEN);
        vm.stopPrank();

        assertEq(settlement.filled(sellHash), 100 * ONE_TOKEN);
        assertEq(settlement.filled(buyHash), 100 * ONE_TOKEN);
        assertEq(token.balanceOf(bob), 100 * ONE_TOKEN);
    }

    function test_ExecuteMatch_ZeroFeeContract_ChargesNothing() public {
        Settlement nofee = new Settlement(admin, matcher, feeRecipient, 0);
        vm.prank(alice);
        token.approve(address(nofee), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(nofee), type(uint256).max);

        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell, nofee);
        bytes memory buySig = _sign(bobKey, buy, nofee);

        vm.prank(matcher);
        nofee.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);

        assertEq(usdc.balanceOf(feeRecipient), 0);
        assertEq(usdc.balanceOf(alice), 10 * ONE_USDC);
    }

    // -------------------------------------------------------------------------
    // executeMatch — validation reverts
    // -------------------------------------------------------------------------

    function test_ExecuteMatch_RevertsIfNotMatcher() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                MATCHER_ROLE
            )
        );
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsOnWrongSide() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(matcher);
        vm.expectRevert(Settlement.WrongSide.selector);
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsOnExpired() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.warp(block.timestamp + 2 hours);

        vm.prank(matcher);
        vm.expectRevert(Settlement.OrderExpired.selector);
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsOnPriceCrossInvalid() public {
        // Buyer bids 8, seller asks 10 — no cross.
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            8 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(matcher);
        vm.expectRevert(Settlement.PriceCrossInvalid.selector);
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsOnTokenMismatch() public {
        SecurityToken other = new SecurityToken("Other", "OTH", issuer, address(compliance));

        Settlement.Order memory sell = Settlement.Order({
            maker: alice,
            token: address(other),
            paymentToken: address(usdc),
            side: Settlement.Side.Sell,
            qty: 1 * ONE_TOKEN,
            price: 10 * ONE_USDC,
            expiresAt: block.timestamp + 1 hours,
            salt: 1
        });
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(matcher);
        vm.expectRevert(Settlement.TokenMismatch.selector);
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsOnBadBuySignature() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        // Mallory signs the buy order instead of Bob.
        (, uint256 malloryKey) = makeAddrAndKey("mallory");
        bytes32 digest = settlement.hashOrder(buy);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(malloryKey, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        bytes memory sellSig = _sign(aliceKey, sell);

        vm.prank(matcher);
        vm.expectRevert(Settlement.InvalidBuySignature.selector);
        settlement.executeMatch(buy, badSig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsOnReplay() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(matcher);
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);

        vm.prank(matcher);
        vm.expectRevert(Settlement.InvalidFillQty.selector);
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsOnZeroFillQty() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(matcher);
        vm.expectRevert(Settlement.InvalidFillQty.selector);
        settlement.executeMatch(buy, buySig, sell, sellSig, 0);
    }

    // -------------------------------------------------------------------------
    // Integration with compliance / freeze / pause
    // -------------------------------------------------------------------------

    function test_ExecuteMatch_RevertsIfBuyerRevokedBetweenSignAndSettle() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(oracle);
        registry.revokeAddress(bob);

        vm.prank(matcher);
        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, bob)
        );
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsIfSellerFrozen() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(agent);
        token.freezeWallet(alice);

        vm.prank(matcher);
        vm.expectRevert(abi.encodeWithSelector(SecurityToken.WalletFrozen.selector, alice));
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_ExecuteMatch_RevertsIfTokenPaused() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        vm.prank(issuer);
        token.pause();

        vm.prank(matcher);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    // -------------------------------------------------------------------------
    // Cancellation
    // -------------------------------------------------------------------------

    function test_CancelOrder_BlocksFutureFills() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );
        Settlement.Order memory buy = _buildOrder(
            bob,
            Settlement.Side.Buy,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            2
        );

        bytes memory sellSig = _sign(aliceKey, sell);
        bytes memory buySig = _sign(bobKey, buy);

        bytes32 sellHash = settlement.hashOrder(sell);

        vm.prank(alice);
        settlement.cancelOrder(sell);
        assertTrue(settlement.cancelled(sellHash));

        vm.prank(matcher);
        vm.expectRevert(
            abi.encodeWithSelector(Settlement.OrderAlreadyCancelled.selector, sellHash)
        );
        settlement.executeMatch(buy, buySig, sell, sellSig, 1 * ONE_TOKEN);
    }

    function test_CancelOrder_RevertsIfNotMaker() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );

        vm.prank(mallory);
        vm.expectRevert(Settlement.NotMaker.selector);
        settlement.cancelOrder(sell);
    }

    function test_CancelOrder_IsIdempotent() public {
        Settlement.Order memory sell = _buildOrder(
            alice,
            Settlement.Side.Sell,
            1 * ONE_TOKEN,
            10 * ONE_USDC,
            block.timestamp + 1 hours,
            1
        );

        vm.startPrank(alice);
        settlement.cancelOrder(sell);
        settlement.cancelOrder(sell); // no-op, no revert
        vm.stopPrank();

        bytes32 h = settlement.hashOrder(sell);
        assertTrue(settlement.cancelled(h));
    }

    // -------------------------------------------------------------------------
    // Fee admin
    // -------------------------------------------------------------------------

    function test_SetFee_HappyPath() public {
        address newRecipient = makeAddr("newTreasury");

        vm.prank(admin);
        settlement.setFee(100, newRecipient);

        assertEq(settlement.feeBps(), 100);
        assertEq(settlement.feeRecipient(), newRecipient);
    }

    function test_SetFee_RevertsAboveCap() public {
        vm.prank(admin);
        vm.expectRevert(Settlement.FeeTooHigh.selector);
        settlement.setFee(501, feeRecipient);
    }

    function test_SetFee_RevertsIfNotAdmin() public {
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                DEFAULT_ADMIN_ROLE
            )
        );
        settlement.setFee(100, feeRecipient);
    }
}
