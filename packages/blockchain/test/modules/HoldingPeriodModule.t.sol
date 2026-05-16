// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {HoldingPeriodModule} from "../../src/modules/HoldingPeriodModule.sol";
import {ComplianceManager} from "../../src/ComplianceManager.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {SecurityToken} from "../../src/SecurityToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract HoldingPeriodModuleTest is Test {
    IdentityRegistry internal registry;
    ComplianceManager internal compliance;
    HoldingPeriodModule internal module;
    SecurityToken internal token;

    address internal owner = makeAddr("owner");
    address internal oracle = makeAddr("oracle");
    address internal issuer = makeAddr("issuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");

    function setUp() public {
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(owner, address(registry));
        module = new HoldingPeriodModule(owner, address(compliance));
        token = new SecurityToken("Arkangeles", "ARK", issuer, address(compliance));

        vm.prank(owner);
        compliance.bindModule(address(token), address(module));

        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    function test_SetLockup_HappyPath() public {
        vm.prank(owner);
        module.setLockup(address(token), 1_000_000);
        assertEq(module.lockupUntil(address(token)), 1_000_000);
    }

    function test_SetLockup_RevertsIfNotOwner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        module.setLockup(address(token), 1_000_000);
    }

    function test_SetLockup_RevertsOnZeroToken() public {
        vm.expectRevert(HoldingPeriodModule.ZeroAddress.selector);
        vm.prank(owner);
        module.setLockup(address(0), 1_000_000);
    }

    // -------------------------------------------------------------------------
    // Integration through SecurityToken
    // -------------------------------------------------------------------------

    function test_Mint_AllowedDuringLockup() public {
        vm.prank(owner);
        module.setLockup(address(token), block.timestamp + 30 days);

        // Mint must work — issuer can distribute primary supply during lockup.
        vm.prank(issuer);
        token.mint(alice, 100e18);

        assertEq(token.balanceOf(alice), 100e18);
    }

    function test_Transfer_BlockedBeforeLockup() public {
        vm.prank(owner);
        module.setLockup(address(token), block.timestamp + 30 days);

        vm.prank(issuer);
        token.mint(alice, 100e18);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, bob)
        );
        vm.prank(alice);
        token.transfer(bob, 10e18);
    }

    function test_Transfer_AllowedAfterLockup() public {
        uint256 lockupEnd = block.timestamp + 30 days;
        vm.prank(owner);
        module.setLockup(address(token), lockupEnd);

        vm.prank(issuer);
        token.mint(alice, 100e18);

        vm.warp(lockupEnd);
        vm.prank(alice);
        token.transfer(bob, 10e18);

        assertEq(token.balanceOf(bob), 10e18);
    }

    function test_NoLockup_AllowsAllTransfers() public {
        // lockupUntil[token] = 0 → unrestricted.
        vm.prank(issuer);
        token.mint(alice, 100e18);
        vm.prank(alice);
        token.transfer(bob, 10e18);
        assertEq(token.balanceOf(bob), 10e18);
    }

    // -------------------------------------------------------------------------
    // moduleAction access control
    // -------------------------------------------------------------------------

    function test_ModuleAction_RevertsIfNotCompliance() public {
        vm.expectRevert(bytes("HoldingPeriod: only compliance"));
        vm.prank(mallory);
        module.moduleAction(address(token), alice, bob, 0);
    }
}
