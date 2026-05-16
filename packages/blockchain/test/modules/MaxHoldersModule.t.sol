// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MaxHoldersModule} from "../../src/modules/MaxHoldersModule.sol";
import {ComplianceManager} from "../../src/ComplianceManager.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {SecurityToken} from "../../src/SecurityToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MaxHoldersModuleTest is Test {
    IdentityRegistry internal registry;
    ComplianceManager internal compliance;
    MaxHoldersModule internal module;
    SecurityToken internal token;

    address internal owner = makeAddr("owner");
    address internal oracle = makeAddr("oracle");
    address internal issuer = makeAddr("issuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal mallory = makeAddr("mallory");

    function setUp() public {
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(owner, address(registry));
        module = new MaxHoldersModule(owner, address(compliance));
        token = new SecurityToken("Arkangeles", "ARK", issuer, address(compliance));

        vm.prank(owner);
        compliance.bindModule(address(token), address(module));

        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        registry.verifyAddress(carol);
        registry.verifyAddress(dave);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    function test_SetMaxHolders_HappyPath() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 99);
        assertEq(module.maxHolders(address(token)), 99);
    }

    function test_SetMaxHolders_RevertsIfNotOwner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        module.setMaxHolders(address(token), 99);
    }

    // -------------------------------------------------------------------------
    // Counting via moduleAction
    // -------------------------------------------------------------------------

    function test_MintIncrementsHolderCount() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 10);

        vm.startPrank(issuer);
        token.mint(alice, 100e18);
        token.mint(bob, 50e18);
        vm.stopPrank();

        assertEq(module.holderCount(address(token)), 2);
        assertTrue(module.isHolder(address(token), alice));
        assertTrue(module.isHolder(address(token), bob));
    }

    function test_SecondMintToSameHolder_DoesNotDouble() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 10);

        vm.startPrank(issuer);
        token.mint(alice, 100e18);
        token.mint(alice, 50e18);
        vm.stopPrank();

        assertEq(module.holderCount(address(token)), 1);
    }

    function test_TransferToNewHolder_Increments() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 10);

        vm.prank(issuer);
        token.mint(alice, 100e18);
        assertEq(module.holderCount(address(token)), 1);

        vm.prank(alice);
        token.transfer(bob, 10e18);
        assertEq(module.holderCount(address(token)), 2);
    }

    function test_FullTransferOut_DecrementsSender() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 10);

        vm.prank(issuer);
        token.mint(alice, 100e18);

        // Alice sends EVERYTHING to bob — alice should no longer be a holder.
        vm.prank(alice);
        token.transfer(bob, 100e18);

        assertEq(module.holderCount(address(token)), 1);
        assertFalse(module.isHolder(address(token), alice));
        assertTrue(module.isHolder(address(token), bob));
    }

    function test_Burn_DecrementsWhenHolderGoesToZero() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 10);

        vm.prank(issuer);
        token.mint(alice, 100e18);
        assertEq(module.holderCount(address(token)), 1);

        vm.prank(alice);
        token.burn(100e18);
        assertEq(module.holderCount(address(token)), 0);
    }

    // -------------------------------------------------------------------------
    // Cap enforcement
    // -------------------------------------------------------------------------

    function test_MintBlocked_WhenCapReached() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 2);

        vm.startPrank(issuer);
        token.mint(alice, 10e18);
        token.mint(bob, 10e18);
        vm.stopPrank();

        // Third holder would exceed cap.
        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, address(0), carol)
        );
        vm.prank(issuer);
        token.mint(carol, 10e18);
    }

    function test_TransferBlocked_WhenCapReached() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 2);

        vm.startPrank(issuer);
        token.mint(alice, 100e18);
        token.mint(bob, 100e18);
        vm.stopPrank();

        // alice→carol would push to 3 holders.
        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, carol)
        );
        vm.prank(alice);
        token.transfer(carol, 10e18);
    }

    function test_ExistingHolder_CanReceiveMore_AtCap() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 2);

        vm.startPrank(issuer);
        token.mint(alice, 100e18);
        token.mint(bob, 100e18);
        vm.stopPrank();

        // Already a holder → no new slot needed.
        vm.prank(alice);
        token.transfer(bob, 10e18);
        assertEq(token.balanceOf(bob), 110e18);
    }

    function test_CapZero_MeansUnlimited() public {
        // Without setMaxHolders, cap is 0 — meaning unlimited.
        vm.startPrank(issuer);
        token.mint(alice, 10e18);
        token.mint(bob, 10e18);
        token.mint(carol, 10e18);
        token.mint(dave, 10e18);
        vm.stopPrank();

        assertEq(module.holderCount(address(token)), 4);
    }

    function test_SlotFreed_AllowsNewHolder() public {
        vm.prank(owner);
        module.setMaxHolders(address(token), 2);

        vm.startPrank(issuer);
        token.mint(alice, 100e18);
        token.mint(bob, 100e18);
        vm.stopPrank();

        // Bob exits completely.
        vm.prank(bob);
        token.burn(100e18);
        assertEq(module.holderCount(address(token)), 1);

        // Now a third holder can join.
        vm.prank(issuer);
        token.mint(carol, 10e18);
        assertEq(module.holderCount(address(token)), 2);
    }

    // -------------------------------------------------------------------------
    // Access control on moduleAction
    // -------------------------------------------------------------------------

    function test_ModuleAction_RevertsIfNotCompliance() public {
        vm.expectRevert(MaxHoldersModule.OnlyCompliance.selector);
        vm.prank(mallory);
        module.moduleAction(address(token), alice, bob, 0);
    }
}
