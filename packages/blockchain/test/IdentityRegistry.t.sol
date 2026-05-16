// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry internal registry;

    address internal oracle = makeAddr("oracle");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal mallory = makeAddr("mallory");

    event AddressVerified(address indexed user, address indexed verifier);
    event AddressRevoked(address indexed user, address indexed verifier);

    function setUp() public {
        registry = new IdentityRegistry(oracle);
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    function test_Deployment_SetsOwnerToOracle() public view {
        assertEq(registry.owner(), oracle);
    }

    function test_Deployment_RevertsOnZeroOwner() public {
        // Ownable v5 rejects zero owner before our custom check, with its own error.
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new IdentityRegistry(address(0));
    }

    // -------------------------------------------------------------------------
    // verifyAddress
    // -------------------------------------------------------------------------

    function test_VerifyAddress_HappyPath() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit AddressVerified(alice, oracle);

        vm.prank(oracle);
        registry.verifyAddress(alice);

        assertTrue(registry.isVerified(alice));
    }

    function test_VerifyAddress_RevertsIfNotOwner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        registry.verifyAddress(alice);
    }

    function test_VerifyAddress_RevertsOnZeroAddress() public {
        vm.expectRevert(IdentityRegistry.ZeroAddress.selector);
        vm.prank(oracle);
        registry.verifyAddress(address(0));
    }

    function test_VerifyAddress_RevertsIfAlreadyVerified() public {
        vm.prank(oracle);
        registry.verifyAddress(alice);

        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.AlreadyVerified.selector, alice));
        vm.prank(oracle);
        registry.verifyAddress(alice);
    }

    // -------------------------------------------------------------------------
    // revokeAddress
    // -------------------------------------------------------------------------

    function test_RevokeAddress_HappyPath() public {
        vm.startPrank(oracle);
        registry.verifyAddress(alice);

        vm.expectEmit(true, true, false, true, address(registry));
        emit AddressRevoked(alice, oracle);
        registry.revokeAddress(alice);
        vm.stopPrank();

        assertFalse(registry.isVerified(alice));
    }

    function test_RevokeAddress_RevertsIfNotOwner() public {
        vm.prank(oracle);
        registry.verifyAddress(alice);

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        registry.revokeAddress(alice);
    }

    function test_RevokeAddress_RevertsIfNotVerified() public {
        vm.expectRevert(abi.encodeWithSelector(IdentityRegistry.NotVerified.selector, alice));
        vm.prank(oracle);
        registry.revokeAddress(alice);
    }

    function test_RevokeAddress_RevertsOnZeroAddress() public {
        vm.expectRevert(IdentityRegistry.ZeroAddress.selector);
        vm.prank(oracle);
        registry.revokeAddress(address(0));
    }

    function test_RevokeThenReVerify_Works() public {
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.revokeAddress(alice);
        registry.verifyAddress(alice);
        vm.stopPrank();

        assertTrue(registry.isVerified(alice));
    }

    // -------------------------------------------------------------------------
    // batchVerifyAddresses
    // -------------------------------------------------------------------------

    function test_BatchVerify_HappyPath() public {
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;

        vm.prank(oracle);
        registry.batchVerifyAddresses(users);

        assertTrue(registry.isVerified(alice));
        assertTrue(registry.isVerified(bob));
    }

    function test_BatchVerify_IsIdempotent_SkipsAlreadyVerified() public {
        vm.prank(oracle);
        registry.verifyAddress(alice);

        address[] memory users = new address[](2);
        users[0] = alice; // already verified — should be skipped, not revert
        users[1] = bob;

        vm.prank(oracle);
        registry.batchVerifyAddresses(users);

        assertTrue(registry.isVerified(alice));
        assertTrue(registry.isVerified(bob));
    }

    function test_BatchVerify_RevertsIfNotOwner() public {
        address[] memory users = new address[](1);
        users[0] = alice;

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        registry.batchVerifyAddresses(users);
    }

    function test_BatchVerify_RevertsOnZeroAddressInBatch() public {
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = address(0);

        vm.expectRevert(IdentityRegistry.ZeroAddress.selector);
        vm.prank(oracle);
        registry.batchVerifyAddresses(users);
    }

    // -------------------------------------------------------------------------
    // isVerified
    // -------------------------------------------------------------------------

    function test_IsVerified_DefaultsToFalse() public view {
        assertFalse(registry.isVerified(alice));
        assertFalse(registry.isVerified(address(0)));
    }

    // -------------------------------------------------------------------------
    // Fuzz
    // -------------------------------------------------------------------------

    function testFuzz_VerifyAndRevoke(address user) public {
        vm.assume(user != address(0));

        vm.startPrank(oracle);
        registry.verifyAddress(user);
        assertTrue(registry.isVerified(user));

        registry.revokeAddress(user);
        assertFalse(registry.isVerified(user));
        vm.stopPrank();
    }
}
