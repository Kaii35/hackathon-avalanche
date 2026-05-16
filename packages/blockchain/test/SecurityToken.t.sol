// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SecurityToken} from "../src/SecurityToken.sol";
import {ComplianceManager} from "../src/ComplianceManager.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract SecurityTokenTest is Test {
    IdentityRegistry internal registry;
    ComplianceManager internal compliance;
    SecurityToken internal token;

    address internal issuer = makeAddr("issuer");
    address internal agent = makeAddr("agent");
    address internal oracle = makeAddr("oracle");

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory");

    bytes32 internal constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;

    function setUp() public {
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(issuer, address(registry));
        token = new SecurityToken("Arkangeles Oferta 42", "ARK42", issuer, address(compliance));

        // Grant the AGENT_ROLE to our compliance officer.
        vm.prank(issuer);
        token.grantRole(AGENT_ROLE, agent);

        // KYC alice, bob, carol — they're the legitimate cap-table participants.
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        registry.verifyAddress(carol);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    function test_Deployment_SetsMetadataAndAdmin() public view {
        assertEq(token.name(), "Arkangeles Oferta 42");
        assertEq(token.symbol(), "ARK42");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
        assertTrue(token.hasRole(DEFAULT_ADMIN_ROLE, issuer));
        assertEq(address(token.complianceManager()), address(compliance));
    }

    function test_Deployment_RevertsOnZeroAdmin() public {
        vm.expectRevert(SecurityToken.ZeroAddress.selector);
        new SecurityToken("X", "X", address(0), address(compliance));
    }

    function test_Deployment_RevertsOnZeroCompliance() public {
        vm.expectRevert(SecurityToken.ZeroAddress.selector);
        new SecurityToken("X", "X", issuer, address(0));
    }

    // -------------------------------------------------------------------------
    // mint
    // -------------------------------------------------------------------------

    function test_Mint_HappyPath() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        assertEq(token.balanceOf(alice), 1_000e18);
        assertEq(token.totalSupply(), 1_000e18);
    }

    function test_Mint_RevertsIfNotAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                DEFAULT_ADMIN_ROLE
            )
        );
        vm.prank(mallory);
        token.mint(alice, 1_000e18);
    }

    function test_Mint_RevertsIfReceiverNotKYC() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SecurityToken.ComplianceCheckFailed.selector,
                address(0),
                mallory
            )
        );
        vm.prank(issuer);
        token.mint(mallory, 1_000e18);
    }

    function test_Mint_RevertsIfReceiverFrozen() public {
        vm.prank(agent);
        token.freezeWallet(alice);

        vm.expectRevert(abi.encodeWithSelector(SecurityToken.WalletFrozen.selector, alice));
        vm.prank(issuer);
        token.mint(alice, 1_000e18);
    }

    // -------------------------------------------------------------------------
    // transfer — happy path & revocation flow
    // -------------------------------------------------------------------------

    function test_Transfer_HappyPath() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.prank(alice);
        token.transfer(bob, 250e18);

        assertEq(token.balanceOf(alice), 750e18);
        assertEq(token.balanceOf(bob), 250e18);
    }

    function test_Transfer_RevertsIfSenderRevokedAfterMint() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        // Compliance officer revokes Alice's KYC (e.g. expired documentation).
        vm.prank(oracle);
        registry.revokeAddress(alice);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, bob)
        );
        vm.prank(alice);
        token.transfer(bob, 250e18);
    }

    function test_Transfer_RevertsIfReceiverNotKYC() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, mallory)
        );
        vm.prank(alice);
        token.transfer(mallory, 250e18);
    }

    // -------------------------------------------------------------------------
    // burn
    // -------------------------------------------------------------------------

    function test_Burn_HappyPath() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.prank(alice);
        token.burn(400e18);

        assertEq(token.balanceOf(alice), 600e18);
        assertEq(token.totalSupply(), 600e18);
    }

    function test_Burn_RevertsIfHolderRevoked() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.prank(oracle);
        registry.revokeAddress(alice);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, address(0))
        );
        vm.prank(alice);
        token.burn(100e18);
    }

    // -------------------------------------------------------------------------
    // freeze
    // -------------------------------------------------------------------------

    function test_Freeze_BlocksOutboundTransfer() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.prank(agent);
        token.freezeWallet(alice);

        vm.expectRevert(abi.encodeWithSelector(SecurityToken.WalletFrozen.selector, alice));
        vm.prank(alice);
        token.transfer(bob, 100e18);
    }

    function test_Freeze_BlocksInboundTransfer() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.prank(agent);
        token.freezeWallet(bob);

        vm.expectRevert(abi.encodeWithSelector(SecurityToken.WalletFrozen.selector, bob));
        vm.prank(alice);
        token.transfer(bob, 100e18);
    }

    function test_Unfreeze_RestoresTransfer() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.startPrank(agent);
        token.freezeWallet(alice);
        token.unfreezeWallet(alice);
        vm.stopPrank();

        vm.prank(alice);
        token.transfer(bob, 100e18);

        assertEq(token.balanceOf(bob), 100e18);
    }

    function test_Freeze_RevertsIfNotAgent() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                AGENT_ROLE
            )
        );
        vm.prank(mallory);
        token.freezeWallet(alice);
    }

    function test_Freeze_RevertsIfAlreadyFrozen() public {
        vm.startPrank(agent);
        token.freezeWallet(alice);
        vm.expectRevert(abi.encodeWithSelector(SecurityToken.AlreadyFrozen.selector, alice));
        token.freezeWallet(alice);
        vm.stopPrank();
    }

    function test_Unfreeze_RevertsIfNotFrozen() public {
        vm.expectRevert(abi.encodeWithSelector(SecurityToken.NotFrozen.selector, alice));
        vm.prank(agent);
        token.unfreezeWallet(alice);
    }

    // -------------------------------------------------------------------------
    // forcedTransfer
    // -------------------------------------------------------------------------

    function test_ForcedTransfer_BypassesSenderFreeze() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        // Alice loses keys; compliance freezes her wallet then moves funds.
        vm.startPrank(agent);
        token.freezeWallet(alice);
        token.forcedTransfer(alice, bob, 600e18);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 400e18);
        assertEq(token.balanceOf(bob), 600e18);
        assertTrue(token.frozen(alice));
    }

    function test_ForcedTransfer_StillEnforcesReceiverKYC() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, mallory)
        );
        vm.prank(agent);
        token.forcedTransfer(alice, mallory, 100e18);
    }

    function test_ForcedTransfer_StillRespectsReceiverFreeze() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.prank(agent);
        token.freezeWallet(bob);

        vm.expectRevert(abi.encodeWithSelector(SecurityToken.WalletFrozen.selector, bob));
        vm.prank(agent);
        token.forcedTransfer(alice, bob, 100e18);
    }

    function test_ForcedTransfer_RevertsIfNotAgent() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                AGENT_ROLE
            )
        );
        vm.prank(mallory);
        token.forcedTransfer(alice, bob, 100e18);
    }

    function test_ForcedTransferContext_DoesNotPersistAcrossCalls() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.startPrank(agent);
        token.freezeWallet(alice);
        token.forcedTransfer(alice, bob, 100e18);
        vm.stopPrank();

        // Direct transfer from the still-frozen alice must revert — proves
        // the transient context flag was correctly cleared.
        vm.expectRevert(abi.encodeWithSelector(SecurityToken.WalletFrozen.selector, alice));
        vm.prank(alice);
        token.transfer(bob, 100e18);
    }

    // -------------------------------------------------------------------------
    // pause
    // -------------------------------------------------------------------------

    function test_Pause_BlocksAllMovement() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.prank(issuer);
        token.pause();

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        token.transfer(bob, 1e18);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(issuer);
        token.mint(alice, 1e18);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(alice);
        token.burn(1e18);

        // Even forced transfer is gated by pause — emergency stop wins.
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(agent);
        token.forcedTransfer(alice, bob, 1e18);
    }

    function test_Unpause_RestoresMovement() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        vm.startPrank(issuer);
        token.pause();
        token.unpause();
        vm.stopPrank();

        vm.prank(alice);
        token.transfer(bob, 100e18);
        assertEq(token.balanceOf(bob), 100e18);
    }

    function test_Pause_RevertsIfNotAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                DEFAULT_ADMIN_ROLE
            )
        );
        vm.prank(mallory);
        token.pause();
    }

    // -------------------------------------------------------------------------
    // setComplianceManager
    // -------------------------------------------------------------------------

    function test_SetComplianceManager_RoutesThroughNewEngine() public {
        vm.prank(issuer);
        token.mint(alice, 1_000e18);

        // Deploy a fresh compliance engine pointing to a registry where bob is
        // NOT verified. The token must respect the swap immediately.
        IdentityRegistry strictRegistry = new IdentityRegistry(oracle);
        vm.prank(oracle);
        strictRegistry.verifyAddress(alice); // bob intentionally left out

        ComplianceManager strictCompliance = new ComplianceManager(issuer, address(strictRegistry));

        vm.prank(issuer);
        token.setComplianceManager(address(strictCompliance));

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, bob)
        );
        vm.prank(alice);
        token.transfer(bob, 100e18);
    }

    function test_SetComplianceManager_RevertsIfNotAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                DEFAULT_ADMIN_ROLE
            )
        );
        vm.prank(mallory);
        token.setComplianceManager(address(compliance));
    }

    function test_SetComplianceManager_RevertsOnZero() public {
        vm.expectRevert(SecurityToken.ZeroAddress.selector);
        vm.prank(issuer);
        token.setComplianceManager(address(0));
    }
}
