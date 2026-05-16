// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IComplianceModule} from "./IComplianceModule.sol";

/**
 * @title  JurisdictionModule
 * @notice Restricts ownership of a SecurityToken to investors whose
 *         declared jurisdiction is on the per-token allowlist. Jurisdiction
 *         codes follow ISO 3166-1 numeric (e.g. MX = 484, US = 840).
 *
 *         Roles:
 *           - DEFAULT_ADMIN_ROLE: per-token allowlist + role management.
 *           - ORACLE_ROLE: sets a wallet's declared jurisdiction (the same
 *             KYC backend that registers identities should hold this).
 */
contract JurisdictionModule is AccessControl, IComplianceModule {
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error OnlyCompliance();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event JurisdictionSet(address indexed user, uint16 jurisdiction);
    event JurisdictionAllowed(address indexed token, uint16 indexed jurisdiction, bool allowed);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice ComplianceManager allowed to call {moduleAction}.
    address public immutable complianceManager;

    /// @notice user => ISO 3166-1 numeric country code.
    mapping(address => uint16) public jurisdictionOf;

    /// @notice token => jurisdiction => allowed?
    mapping(address => mapping(uint16 => bool)) public isJurisdictionAllowed;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address admin, address oracle, address complianceManager_) {
        if (admin == address(0) || oracle == address(0) || complianceManager_ == address(0))
            revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_ROLE, oracle);
        complianceManager = complianceManager_;
    }

    // -------------------------------------------------------------------------
    // Oracle
    // -------------------------------------------------------------------------

    /// @notice Records the declared jurisdiction of `user`. Set during KYC.
    function setJurisdiction(address user, uint16 code) external onlyRole(ORACLE_ROLE) {
        if (user == address(0)) revert ZeroAddress();
        jurisdictionOf[user] = code;
        emit JurisdictionSet(user, code);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Marks `code` as (dis)allowed to hold `token`.
    function setJurisdictionAllowed(
        address token,
        uint16 code,
        bool allowed
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        isJurisdictionAllowed[token][code] = allowed;
        emit JurisdictionAllowed(token, code, allowed);
    }

    // -------------------------------------------------------------------------
    // IComplianceModule
    // -------------------------------------------------------------------------

    /// @inheritdoc IComplianceModule
    function canTransfer(
        address token,
        address,
        /*from*/ address to,
        uint256 /*amount*/
    ) external view returns (bool) {
        // Burns are always allowed; nobody acquires the tokens.
        if (to == address(0)) return true;
        return isJurisdictionAllowed[token][jurisdictionOf[to]];
    }

    /// @inheritdoc IComplianceModule
    function moduleAction(
        address,
        /*token*/ address,
        /*from*/ address,
        /*to*/ uint256 /*amount*/
    ) external view {
        // Stateless module — only used to gate access.
        if (msg.sender != complianceManager) revert OnlyCompliance();
    }
}
