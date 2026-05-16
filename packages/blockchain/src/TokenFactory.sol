// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SecurityToken} from "./SecurityToken.sol";

/**
 * @title  TokenFactory
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice Canonical deployer of {SecurityToken} instances. One token per
 *         offering; the factory wires every new token to the shared
 *         {ComplianceManager} so compliance rules stay uniform across the
 *         platform.
 *
 *         The deployment flow is atomic and produces a token whose roles
 *         are already handed off to the issuer:
 *
 *           1. Deploy {SecurityToken} with the factory as temporary admin.
 *           2. Grant AGENT_ROLE to the supplied compliance agent.
 *           3. Optionally mint the initial supply to a KYC-verified
 *              recipient (compliance check still runs).
 *           4. Grant DEFAULT_ADMIN_ROLE to the final issuer admin.
 *           5. Factory renounces its own admin role.
 *
 *         After the transaction the factory holds no privileges on the
 *         deployed token — it is just a registry that maps offering IDs to
 *         token addresses so the indexer and frontend can enumerate them.
 *
 * @dev `offeringId` is expected to be `keccak256(backendUuid)` so the
 *      on-chain key is collision-resistant and stable.
 */
contract TokenFactory is Ownable {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error InvalidOfferingId();
    error OfferingAlreadyExists(bytes32 offeringId);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ComplianceManagerUpdated(address indexed previous, address indexed current);

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

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice Compliance engine injected into every newly deployed token.
    address public complianceManager;

    /// @notice offeringId => deployed SecurityToken address.
    mapping(bytes32 => address) public offerings;

    /// @dev Append-only list of every offering ever deployed by this factory.
    address[] private _allOfferings;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param initialOwner       Platform admin (typically the Arkangeles
     *                           multisig) authorised to deploy offerings.
     * @param complianceManager_ Address of the deployed {ComplianceManager}
     *                           that every new token will reference.
     */
    constructor(address initialOwner, address complianceManager_) Ownable(initialOwner) {
        if (initialOwner == address(0) || complianceManager_ == address(0)) revert ZeroAddress();

        complianceManager = complianceManager_;
        emit ComplianceManagerUpdated(address(0), complianceManager_);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /**
     * @notice Replaces the default {ComplianceManager} used for future
     *         deployments. Already-deployed tokens are not affected — each
     *         token holds its own reference and can be migrated individually
     *         via {SecurityToken.setComplianceManager}.
     */
    function setComplianceManager(address newManager) external onlyOwner {
        if (newManager == address(0)) revert ZeroAddress();

        address previous = complianceManager;
        complianceManager = newManager;
        emit ComplianceManagerUpdated(previous, newManager);
    }

    // -------------------------------------------------------------------------
    // Deployment
    // -------------------------------------------------------------------------

    /**
     * @notice Deploys a new SecurityToken for an offering and hands off
     *         control to the issuer in a single transaction.
     *
     * @param offeringId       Unique offering identifier (e.g.
     *                         `keccak256(backendUuid)`).
     * @param name_            ERC-20 name of the participation token.
     * @param symbol_          ERC-20 symbol of the participation token.
     * @param issuerAdmin      Address that will receive DEFAULT_ADMIN_ROLE on
     *                         the new token (the issuer's operator multisig).
     * @param complianceAgent  Address that will receive AGENT_ROLE on the
     *                         new token (freeze / forced transfer authority).
     * @param initialSupply    Optional initial mint amount. Zero to skip.
     * @param initialRecipient Recipient of the initial mint. Must be
     *                         KYC-verified in the {IdentityRegistry} if
     *                         `initialSupply > 0`. Ignored otherwise.
     * @return token Address of the deployed {SecurityToken}.
     */
    function deployOffering(
        bytes32 offeringId,
        string calldata name_,
        string calldata symbol_,
        address issuerAdmin,
        address complianceAgent,
        uint256 initialSupply,
        address initialRecipient
    ) external onlyOwner returns (address token) {
        if (offeringId == bytes32(0)) revert InvalidOfferingId();
        if (offerings[offeringId] != address(0)) revert OfferingAlreadyExists(offeringId);
        if (issuerAdmin == address(0) || complianceAgent == address(0)) revert ZeroAddress();
        if (initialSupply > 0 && initialRecipient == address(0)) revert ZeroAddress();

        // 1. Deploy with the factory as temporary admin so we can mint + grant roles.
        SecurityToken newToken = new SecurityToken(
            name_,
            symbol_,
            address(this),
            complianceManager
        );
        token = address(newToken);

        // 2. Grant compliance agent role.
        newToken.grantRole(newToken.AGENT_ROLE(), complianceAgent);

        // 3. Optional initial mint (compliance is enforced inside `_update`).
        if (initialSupply > 0) {
            newToken.mint(initialRecipient, initialSupply);
        }

        // 4. Hand off admin to the issuer.
        newToken.grantRole(newToken.DEFAULT_ADMIN_ROLE(), issuerAdmin);

        // 5. Factory renounces its temporary admin role — zero residual power.
        newToken.renounceRole(newToken.DEFAULT_ADMIN_ROLE(), address(this));

        // 6. Index for enumeration.
        offerings[offeringId] = token;
        _allOfferings.push(token);

        emit OfferingDeployed(
            offeringId,
            token,
            issuerAdmin,
            complianceAgent,
            name_,
            symbol_,
            initialSupply,
            initialRecipient
        );
    }

    // -------------------------------------------------------------------------
    // Read API
    // -------------------------------------------------------------------------

    /// @notice Returns the total number of offerings deployed by this factory.
    function offeringsCount() external view returns (uint256) {
        return _allOfferings.length;
    }

    /// @notice Returns the full list of deployed offering addresses.
    function allOfferings() external view returns (address[] memory) {
        return _allOfferings;
    }

    /// @notice Returns the offering address at index `i`. Reverts on OOB.
    function offeringAt(uint256 i) external view returns (address) {
        return _allOfferings[i];
    }
}
