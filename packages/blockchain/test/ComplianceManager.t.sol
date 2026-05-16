// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {ComplianceManager} from "../src/ComplianceManager.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ComplianceManagerTest is Test {
    IdentityRegistry internal registry;
    ComplianceManager internal compliance;

    address internal owner = makeAddr("owner");
    address internal oracle = makeAddr("oracle");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");

    event IdentityRegistryUpdated(address indexed previous, address indexed current);

    function setUp() public {
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(owner, address(registry));
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    function test_Deployment_SetsOwnerAndRegistry() public view {
        assertEq(compliance.owner(), owner);
        assertEq(address(compliance.identityRegistry()), address(registry));
    }

    function test_Deployment_EmitsRegistryUpdatedFromZero() public {
        vm.expectEmit(true, true, false, true);
        emit IdentityRegistryUpdated(address(0), address(registry));
        new ComplianceManager(owner, address(registry));
    }

    function test_Deployment_RevertsOnZeroOwner() public {
        // Ownable rejects zero owner first, with its own typed error.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new ComplianceManager(address(0), address(registry));
    }

    function test_Deployment_RevertsOnZeroRegistry() public {
        vm.expectRevert(ComplianceManager.ZeroAddress.selector);
        new ComplianceManager(owner, address(0));
    }

    // -------------------------------------------------------------------------
    // setIdentityRegistry
    // -------------------------------------------------------------------------

    function test_SetIdentityRegistry_HappyPath() public {
        IdentityRegistry newRegistry = new IdentityRegistry(oracle);

        vm.expectEmit(true, true, false, true, address(compliance));
        emit IdentityRegistryUpdated(address(registry), address(newRegistry));

        vm.prank(owner);
        compliance.setIdentityRegistry(address(newRegistry));

        assertEq(address(compliance.identityRegistry()), address(newRegistry));
    }

    function test_SetIdentityRegistry_RevertsIfNotOwner() public {
        IdentityRegistry newRegistry = new IdentityRegistry(oracle);

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        compliance.setIdentityRegistry(address(newRegistry));
    }

    function test_SetIdentityRegistry_RevertsOnZeroAddress() public {
        vm.expectRevert(ComplianceManager.ZeroAddress.selector);
        vm.prank(owner);
        compliance.setIdentityRegistry(address(0));
    }

    // -------------------------------------------------------------------------
    // canTransfer
    // -------------------------------------------------------------------------

    function test_CanTransfer_TrueWhenBothVerified() public {
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        vm.stopPrank();

        assertTrue(compliance.canTransfer(alice, bob, 0));
    }

    function test_CanTransfer_FalseWhenSenderUnverified() public {
        vm.prank(oracle);
        registry.verifyAddress(bob); // only receiver verified

        assertFalse(compliance.canTransfer(alice, bob, 0));
    }

    function test_CanTransfer_FalseWhenReceiverUnverified() public {
        vm.prank(oracle);
        registry.verifyAddress(alice); // only sender verified

        assertFalse(compliance.canTransfer(alice, bob, 0));
    }

    function test_CanTransfer_FalseWhenBothUnverified() public view {
        assertFalse(compliance.canTransfer(alice, bob, 0));
    }

    function test_CanTransfer_FalseAfterRevocation() public {
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        vm.stopPrank();

        assertTrue(compliance.canTransfer(alice, bob, 0));

        vm.prank(oracle);
        registry.revokeAddress(bob);

        assertFalse(compliance.canTransfer(alice, bob, 0));
    }

    // -------------------------------------------------------------------------
    // Mint / burn semantics — zero side is skipped
    // -------------------------------------------------------------------------

    function test_CanTransfer_AllowsMint_WhenReceiverVerified() public {
        vm.prank(oracle);
        registry.verifyAddress(alice);

        // from == address(0) is a mint — should not require sender KYC.
        assertTrue(compliance.canTransfer(address(0), alice, 0));
    }

    function test_CanTransfer_BlocksMint_WhenReceiverUnverified() public view {
        assertFalse(compliance.canTransfer(address(0), alice, 0));
    }

    function test_CanTransfer_AllowsBurn_WhenSenderVerified() public {
        vm.prank(oracle);
        registry.verifyAddress(alice);

        // to == address(0) is a burn — should not require receiver KYC.
        assertTrue(compliance.canTransfer(alice, address(0), 0));
    }

    function test_CanTransfer_BlocksBurn_WhenSenderUnverified() public view {
        assertFalse(compliance.canTransfer(alice, address(0), 0));
    }

    // -------------------------------------------------------------------------
    // Registry hot-swap — proves the indirection works end-to-end
    // -------------------------------------------------------------------------

    function test_CanTransfer_UsesNewRegistryAfterHotSwap() public {
        // alice + bob verified in the OLD registry
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        vm.stopPrank();
        assertTrue(compliance.canTransfer(alice, bob, 0));

        // Swap to a fresh registry where nobody is verified
        IdentityRegistry newRegistry = new IdentityRegistry(oracle);
        vm.prank(owner);
        compliance.setIdentityRegistry(address(newRegistry));

        assertFalse(compliance.canTransfer(alice, bob, 0));

        // Verify them in the new one — transfer becomes allowed again
        vm.startPrank(oracle);
        newRegistry.verifyAddress(alice);
        newRegistry.verifyAddress(bob);
        vm.stopPrank();
        assertTrue(compliance.canTransfer(alice, bob, 0));
    }

    // -------------------------------------------------------------------------
    // Fuzz
    // -------------------------------------------------------------------------

    function testFuzz_CanTransfer_RespectsBothFlags(
        address from,
        address to,
        bool verifyFrom,
        bool verifyTo
    ) public {
        vm.assume(from != address(0) && to != address(0));
        vm.assume(from != to);

        vm.startPrank(oracle);
        if (verifyFrom) registry.verifyAddress(from);
        if (verifyTo) registry.verifyAddress(to);
        vm.stopPrank();

        bool expected = verifyFrom && verifyTo;
        assertEq(compliance.canTransfer(from, to, 0), expected);
    }
}
