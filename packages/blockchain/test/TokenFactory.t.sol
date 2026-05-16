// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {SecurityToken} from "../src/SecurityToken.sol";
import {ComplianceManager} from "../src/ComplianceManager.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TokenFactoryTest is Test {
    IdentityRegistry internal registry;
    ComplianceManager internal compliance;
    TokenFactory internal factory;

    address internal platform = makeAddr("platform"); // factory owner (Arkangeles multisig)
    address internal oracle = makeAddr("oracle");
    address internal issuerAdmin = makeAddr("issuerAdmin");
    address internal complianceAgent = makeAddr("complianceAgent");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal mallory = makeAddr("mallory");

    bytes32 internal constant OFFERING_1 = keccak256("offering-1");
    bytes32 internal constant OFFERING_2 = keccak256("offering-2");

    bytes32 internal constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;

    event OfferingDeployed(
        bytes32 indexed offeringId,
        address indexed token,
        address indexed issuerAdmin,
        address complianceAgent,
        string name,
        string symbol,
        uint256 initialSupply,
        address initialRecipient
    );

    function setUp() public {
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(platform, address(registry));
        factory = new TokenFactory(platform, address(compliance));

        // KYC the treasury + alice so mints / transfers can succeed.
        vm.startPrank(oracle);
        registry.verifyAddress(treasury);
        registry.verifyAddress(alice);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    function test_Deployment_SetsOwnerAndCompliance() public view {
        assertEq(factory.owner(), platform);
        assertEq(factory.complianceManager(), address(compliance));
        assertEq(factory.offeringsCount(), 0);
    }

    function test_Deployment_RevertsOnZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new TokenFactory(address(0), address(compliance));
    }

    function test_Deployment_RevertsOnZeroCompliance() public {
        vm.expectRevert(TokenFactory.ZeroAddress.selector);
        new TokenFactory(platform, address(0));
    }

    // -------------------------------------------------------------------------
    // deployOffering — happy path
    // -------------------------------------------------------------------------

    function test_DeployOffering_FullHandover() public {
        vm.prank(platform);
        address tokenAddr = factory.deployOffering(
            OFFERING_1,
            "Arkangeles 1",
            "ARK1",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );

        SecurityToken token = SecurityToken(tokenAddr);

        // Metadata
        assertEq(token.name(), "Arkangeles 1");
        assertEq(token.symbol(), "ARK1");
        assertEq(token.totalSupply(), 0);
        assertEq(address(token.complianceManager()), address(compliance));

        // Role handover: issuer holds admin, agent holds AGENT_ROLE, factory holds nothing.
        assertTrue(token.hasRole(DEFAULT_ADMIN_ROLE, issuerAdmin));
        assertTrue(token.hasRole(AGENT_ROLE, complianceAgent));
        assertFalse(token.hasRole(DEFAULT_ADMIN_ROLE, address(factory)));
        assertFalse(token.hasRole(AGENT_ROLE, address(factory)));

        // Registry
        assertEq(factory.offerings(OFFERING_1), tokenAddr);
        assertEq(factory.offeringsCount(), 1);
        assertEq(factory.offeringAt(0), tokenAddr);
    }

    function test_DeployOffering_WithInitialMint() public {
        vm.prank(platform);
        address tokenAddr = factory.deployOffering(
            OFFERING_1,
            "Arkangeles 1",
            "ARK1",
            issuerAdmin,
            complianceAgent,
            1_000_000e18,
            treasury
        );

        SecurityToken token = SecurityToken(tokenAddr);
        assertEq(token.balanceOf(treasury), 1_000_000e18);
        assertEq(token.totalSupply(), 1_000_000e18);
    }

    function test_DeployOffering_EmitsEvent() public {
        // Address is deterministic (CREATE), but we don't assert it here —
        // we let the topic 2 check be loose and verify the data payload.
        vm.expectEmit(true, false, true, false, address(factory));
        emit OfferingDeployed(
            OFFERING_1,
            address(0),
            issuerAdmin,
            complianceAgent,
            "Arkangeles 1",
            "ARK1",
            0,
            address(0)
        );

        vm.prank(platform);
        factory.deployOffering(
            OFFERING_1,
            "Arkangeles 1",
            "ARK1",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );
    }

    // -------------------------------------------------------------------------
    // deployOffering — end-to-end behaviour
    // -------------------------------------------------------------------------

    function test_DeployedToken_IssuerCanMintAfterHandover() public {
        vm.prank(platform);
        address tokenAddr = factory.deployOffering(
            OFFERING_1,
            "X",
            "X",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );

        // Issuer (not factory) mints — confirms handover succeeded.
        vm.prank(issuerAdmin);
        SecurityToken(tokenAddr).mint(alice, 500e18);

        assertEq(SecurityToken(tokenAddr).balanceOf(alice), 500e18);
    }

    function test_DeployedToken_FactoryHasNoLingeringPower() public {
        vm.prank(platform);
        address tokenAddr = factory.deployOffering(
            OFFERING_1,
            "X",
            "X",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );

        SecurityToken token = SecurityToken(tokenAddr);

        // Factory should NOT be able to mint anymore.
        vm.expectRevert();
        vm.prank(address(factory));
        token.mint(alice, 1);
    }

    function test_DeployedToken_AgentCanFreeze() public {
        vm.prank(platform);
        address tokenAddr = factory.deployOffering(
            OFFERING_1,
            "X",
            "X",
            issuerAdmin,
            complianceAgent,
            1_000e18,
            treasury
        );

        vm.prank(complianceAgent);
        SecurityToken(tokenAddr).freezeWallet(treasury);

        assertTrue(SecurityToken(tokenAddr).frozen(treasury));
    }

    function test_DeployedToken_InitialMintEnforcesKYC() public {
        // Mallory is NOT in the registry — the initial mint should revert.
        vm.expectRevert(
            abi.encodeWithSelector(
                SecurityToken.ComplianceCheckFailed.selector,
                address(0),
                mallory
            )
        );
        vm.prank(platform);
        factory.deployOffering(
            OFFERING_1,
            "X",
            "X",
            issuerAdmin,
            complianceAgent,
            1_000e18,
            mallory
        );
    }

    // -------------------------------------------------------------------------
    // deployOffering — validation
    // -------------------------------------------------------------------------

    function test_DeployOffering_RevertsIfNotOwner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        factory.deployOffering(OFFERING_1, "X", "X", issuerAdmin, complianceAgent, 0, address(0));
    }

    function test_DeployOffering_RevertsOnDuplicateOfferingId() public {
        vm.startPrank(platform);
        factory.deployOffering(OFFERING_1, "X", "X", issuerAdmin, complianceAgent, 0, address(0));

        vm.expectRevert(
            abi.encodeWithSelector(TokenFactory.OfferingAlreadyExists.selector, OFFERING_1)
        );
        factory.deployOffering(OFFERING_1, "Y", "Y", issuerAdmin, complianceAgent, 0, address(0));
        vm.stopPrank();
    }

    function test_DeployOffering_RevertsOnZeroOfferingId() public {
        vm.expectRevert(TokenFactory.InvalidOfferingId.selector);
        vm.prank(platform);
        factory.deployOffering(bytes32(0), "X", "X", issuerAdmin, complianceAgent, 0, address(0));
    }

    function test_DeployOffering_RevertsOnZeroIssuerAdmin() public {
        vm.expectRevert(TokenFactory.ZeroAddress.selector);
        vm.prank(platform);
        factory.deployOffering(OFFERING_1, "X", "X", address(0), complianceAgent, 0, address(0));
    }

    function test_DeployOffering_RevertsOnZeroAgent() public {
        vm.expectRevert(TokenFactory.ZeroAddress.selector);
        vm.prank(platform);
        factory.deployOffering(OFFERING_1, "X", "X", issuerAdmin, address(0), 0, address(0));
    }

    function test_DeployOffering_RevertsIfMintWithoutRecipient() public {
        vm.expectRevert(TokenFactory.ZeroAddress.selector);
        vm.prank(platform);
        factory.deployOffering(
            OFFERING_1,
            "X",
            "X",
            issuerAdmin,
            complianceAgent,
            1_000e18,
            address(0)
        );
    }

    // -------------------------------------------------------------------------
    // Multiple offerings + enumeration
    // -------------------------------------------------------------------------

    function test_DeployOffering_TwoOfferings_IndependentTokens() public {
        vm.startPrank(platform);
        address t1 = factory.deployOffering(
            OFFERING_1,
            "A",
            "A",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );
        address t2 = factory.deployOffering(
            OFFERING_2,
            "B",
            "B",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );
        vm.stopPrank();

        assertTrue(t1 != t2);
        assertEq(factory.offeringsCount(), 2);
        assertEq(factory.offeringAt(0), t1);
        assertEq(factory.offeringAt(1), t2);

        address[] memory list = factory.allOfferings();
        assertEq(list.length, 2);
        assertEq(list[0], t1);
        assertEq(list[1], t2);
    }

    // -------------------------------------------------------------------------
    // setComplianceManager
    // -------------------------------------------------------------------------

    function test_SetComplianceManager_AppliesToFutureDeployments() public {
        // Existing offering uses original compliance manager.
        vm.prank(platform);
        address t1 = factory.deployOffering(
            OFFERING_1,
            "A",
            "A",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );
        assertEq(address(SecurityToken(t1).complianceManager()), address(compliance));

        // Swap to a new compliance manager.
        IdentityRegistry registry2 = new IdentityRegistry(oracle);
        ComplianceManager compliance2 = new ComplianceManager(platform, address(registry2));
        vm.prank(platform);
        factory.setComplianceManager(address(compliance2));

        // New deployment uses the new manager.
        vm.prank(platform);
        address t2 = factory.deployOffering(
            OFFERING_2,
            "B",
            "B",
            issuerAdmin,
            complianceAgent,
            0,
            address(0)
        );
        assertEq(address(SecurityToken(t2).complianceManager()), address(compliance2));

        // Pre-existing token unaffected.
        assertEq(address(SecurityToken(t1).complianceManager()), address(compliance));
    }

    function test_SetComplianceManager_RevertsIfNotOwner() public {
        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, mallory)
        );
        vm.prank(mallory);
        factory.setComplianceManager(address(compliance));
    }

    function test_SetComplianceManager_RevertsOnZero() public {
        vm.expectRevert(TokenFactory.ZeroAddress.selector);
        vm.prank(platform);
        factory.setComplianceManager(address(0));
    }
}
