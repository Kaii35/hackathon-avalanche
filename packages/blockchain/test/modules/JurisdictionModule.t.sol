// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {JurisdictionModule} from "../../src/modules/JurisdictionModule.sol";
import {ComplianceManager} from "../../src/ComplianceManager.sol";
import {IdentityRegistry} from "../../src/IdentityRegistry.sol";
import {SecurityToken} from "../../src/SecurityToken.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract JurisdictionModuleTest is Test {
    IdentityRegistry internal registry;
    ComplianceManager internal compliance;
    JurisdictionModule internal module;
    SecurityToken internal token;

    address internal admin = makeAddr("admin");
    address internal oracle = makeAddr("oracle");
    address internal issuer = makeAddr("issuer");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory");

    uint16 internal constant MX = 484;
    uint16 internal constant US = 840;
    uint16 internal constant BR = 76;

    bytes32 internal constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;

    function setUp() public {
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(admin, address(registry));
        module = new JurisdictionModule(admin, oracle, address(compliance));
        token = new SecurityToken("Arkangeles", "ARK", issuer, address(compliance));

        vm.prank(admin);
        compliance.bindModule(address(token), address(module));

        // Only MX is allowed by default for this token.
        vm.prank(admin);
        module.setJurisdictionAllowed(address(token), MX, true);

        // KYC alice (MX), bob (MX), carol (US).
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        registry.verifyAddress(carol);
        module.setJurisdiction(alice, MX);
        module.setJurisdiction(bob, MX);
        module.setJurisdiction(carol, US);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Oracle / admin RBAC
    // -------------------------------------------------------------------------

    function test_SetJurisdiction_RevertsIfNotOracle() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                ORACLE_ROLE
            )
        );
        vm.prank(mallory);
        module.setJurisdiction(alice, MX);
    }

    function test_SetJurisdictionAllowed_RevertsIfNotAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                mallory,
                DEFAULT_ADMIN_ROLE
            )
        );
        vm.prank(mallory);
        module.setJurisdictionAllowed(address(token), MX, true);
    }

    // -------------------------------------------------------------------------
    // Transfer enforcement
    // -------------------------------------------------------------------------

    function test_TransferBetweenMX_Allowed() public {
        vm.prank(issuer);
        token.mint(alice, 100e18);

        vm.prank(alice);
        token.transfer(bob, 50e18);

        assertEq(token.balanceOf(bob), 50e18);
    }

    function test_TransferToDisallowedJurisdiction_Reverts() public {
        vm.prank(issuer);
        token.mint(alice, 100e18);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, carol)
        );
        vm.prank(alice);
        token.transfer(carol, 10e18);
    }

    function test_MintToDisallowedJurisdiction_Reverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, address(0), carol)
        );
        vm.prank(issuer);
        token.mint(carol, 10e18);
    }

    function test_OpeningNewJurisdiction_UnlocksTransfer() public {
        vm.prank(issuer);
        token.mint(alice, 100e18);

        // Carol blocked initially.
        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, carol)
        );
        vm.prank(alice);
        token.transfer(carol, 10e18);

        // Open US.
        vm.prank(admin);
        module.setJurisdictionAllowed(address(token), US, true);

        vm.prank(alice);
        token.transfer(carol, 10e18);
        assertEq(token.balanceOf(carol), 10e18);
    }

    function test_ClosingJurisdiction_BlocksFutureTransfers() public {
        vm.prank(issuer);
        token.mint(alice, 100e18);

        vm.prank(alice);
        token.transfer(bob, 10e18); // OK

        // Revoke MX as allowed.
        vm.prank(admin);
        module.setJurisdictionAllowed(address(token), MX, false);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, alice, bob)
        );
        vm.prank(alice);
        token.transfer(bob, 10e18);
    }

    function test_UnknownJurisdiction_Blocked() public {
        // dave verified but has no jurisdiction set (defaults to 0).
        address dave = makeAddr("dave");
        vm.prank(oracle);
        registry.verifyAddress(dave);

        vm.expectRevert(
            abi.encodeWithSelector(SecurityToken.ComplianceCheckFailed.selector, address(0), dave)
        );
        vm.prank(issuer);
        token.mint(dave, 10e18);
    }

    function test_Burn_AlwaysAllowed_RegardlessOfJurisdiction() public {
        vm.prank(issuer);
        token.mint(alice, 100e18);

        // Even if MX is closed retroactively, alice can still burn.
        vm.prank(admin);
        module.setJurisdictionAllowed(address(token), MX, false);

        // Burn would still hit the bilateral KYC + JurisdictionModule.canTransfer.
        // canTransfer for jurisdiction returns true when to == 0 (burn allowed).
        // But the bilateral KYC check still runs against alice — she IS verified.
        vm.prank(alice);
        token.burn(50e18);
        assertEq(token.balanceOf(alice), 50e18);
    }

    // -------------------------------------------------------------------------
    // moduleAction access control
    // -------------------------------------------------------------------------

    function test_ModuleAction_RevertsIfNotCompliance() public {
        vm.expectRevert(JurisdictionModule.OnlyCompliance.selector);
        vm.prank(mallory);
        module.moduleAction(address(token), alice, bob, 0);
    }
}
