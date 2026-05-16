// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IComplianceModule} from "./IComplianceModule.sol";

/**
 * @title  HoldingPeriodModule
 * @notice Blocks secondary-market transfers before a configured lockup
 *         timestamp. Mints (`from == 0`) and burns (`to == 0`) are NOT
 *         restricted — the issuer can deliver primary supply during the
 *         lockup, and recovery / freeze flows still operate.
 *
 *         Per-token configuration: `lockupUntil[token]` (unix seconds).
 *         A token with zero lockup is unrestricted.
 */
contract HoldingPeriodModule is Ownable, IComplianceModule {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event LockupSet(address indexed token, uint256 lockupUntil);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice ComplianceManager allowed to invoke {moduleAction}.
    address public immutable complianceManager;

    /// @notice token => unix timestamp until which secondary transfers are blocked.
    mapping(address => uint256) public lockupUntil;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner, address complianceManager_) Ownable(initialOwner) {
        if (initialOwner == address(0) || complianceManager_ == address(0)) revert ZeroAddress();
        complianceManager = complianceManager_;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Sets the lockup deadline for `token`. Zero means unlimited.
    function setLockup(address token, uint256 lockupUntil_) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        lockupUntil[token] = lockupUntil_;
        emit LockupSet(token, lockupUntil_);
    }

    // -------------------------------------------------------------------------
    // IComplianceModule
    // -------------------------------------------------------------------------

    /// @inheritdoc IComplianceModule
    function canTransfer(
        address token,
        address from,
        address,
        /*to*/ uint256 /*amount*/
    ) external view returns (bool) {
        // Mints (primary distribution by issuer) always allowed.
        if (from == address(0)) return true;
        return block.timestamp >= lockupUntil[token];
    }

    /// @inheritdoc IComplianceModule
    function moduleAction(
        address,
        /*token*/ address,
        /*from*/ address,
        /*to*/ uint256 /*amount*/
    ) external view {
        // Lockup is purely time-based — no state to update.
        // The view modifier prevents accidental state changes from inside this no-op.
        require(msg.sender == complianceManager, "HoldingPeriod: only compliance");
    }
}
