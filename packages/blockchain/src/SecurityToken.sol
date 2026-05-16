// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @dev External surface of the compliance engine. Mirrors {ComplianceManager}
 *      so the token can be linked to any future engine that respects the same
 *      contract.
 */
interface IComplianceManager {
    function canTransfer(address from, address to, uint256 amount) external view returns (bool);
    function moduleAction(address from, address to, uint256 amount) external;
}

/**
 * @title  SecurityToken
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice ERC-20 representation of an IFC participation. Every state-changing
 *         token movement — mint, burn, transfer, forced transfer — is routed
 *         through the OZ v5 `_update` hook and gated by:
 *
 *           1. {Pausable} — emergency stop for the whole instrument.
 *           2. Per-wallet freeze flags — judicial / AML holds.
 *           3. {ComplianceManager.canTransfer} — KYC and (future) modular
 *              compliance rules.
 *
 *         Roles:
 *           - DEFAULT_ADMIN_ROLE: issuer (e.g. Arkangeles operator multisig).
 *             Mints supply, pauses the token, swaps the compliance engine,
 *             grants/revokes AGENT_ROLE.
 *           - AGENT_ROLE: compliance officer. Freezes wallets, executes
 *             forced transfers (recovery / court orders).
 *
 * @dev Forced transfer bypasses the freeze check on `from` (the whole point
 *      of recovery is moving funds out of a frozen / lost wallet) but still
 *      enforces compliance on the destination so we never produce a
 *      non-KYC'd holder.
 */
contract SecurityToken is ERC20, AccessControl, Pausable {
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    /// @notice Role allowed to freeze wallets and execute forced transfers.
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error WalletFrozen(address wallet);
    error ComplianceCheckFailed(address from, address to);
    error AlreadyFrozen(address wallet);
    error NotFrozen(address wallet);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ComplianceManagerUpdated(address indexed previous, address indexed current);
    event WalletFrozenSet(address indexed wallet, address indexed agent);
    event WalletUnfrozenSet(address indexed wallet, address indexed agent);
    event ForcedTransferExecuted(
        address indexed from,
        address indexed to,
        uint256 amount,
        address indexed agent
    );

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice Compliance engine consulted on every transfer.
    IComplianceManager public complianceManager;

    /// @notice Per-wallet freeze flag. Frozen wallets cannot send or receive.
    mapping(address => bool) public frozen;

    /// @dev Transient flag used to skip the `from` freeze check during a
    ///      legitimate forced transfer (recovery flow). Compliance and pause
    ///      still apply.
    bool private _forcedTransferContext;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param name_              ERC-20 name (e.g. "Arkangeles Oferta #042").
     * @param symbol_            ERC-20 symbol (e.g. "ARK42").
     * @param admin              Issuer address — receives DEFAULT_ADMIN_ROLE.
     * @param complianceManager_ Deployed {ComplianceManager} address.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address admin,
        address complianceManager_
    ) ERC20(name_, symbol_) {
        if (admin == address(0) || complianceManager_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        complianceManager = IComplianceManager(complianceManager_);
        emit ComplianceManagerUpdated(address(0), complianceManager_);
    }

    // -------------------------------------------------------------------------
    // Admin (issuer)
    // -------------------------------------------------------------------------

    /**
     * @notice Mints `amount` units to `to`. Routed through `_update` so the
     *         compliance check runs and rejects non-KYC'd recipients.
     */
    function mint(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Replaces the linked {ComplianceManager}. Use to plug in a new
     *         engine version without redeploying the token.
     */
    function setComplianceManager(address newManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newManager == address(0)) revert ZeroAddress();

        address previous = address(complianceManager);
        complianceManager = IComplianceManager(newManager);
        emit ComplianceManagerUpdated(previous, newManager);
    }

    /// @notice Halts all token movement. Regulatory / emergency stop.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Resumes token movement.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Holder
    // -------------------------------------------------------------------------

    /**
     * @notice Burns `amount` from the caller's balance. Compliance hook still
     *         runs (the caller's KYC must be valid to dispose of holdings).
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Agent (compliance officer)
    // -------------------------------------------------------------------------

    /// @notice Freezes `wallet` — blocks outbound and inbound transfers.
    function freezeWallet(address wallet) external onlyRole(AGENT_ROLE) {
        if (wallet == address(0)) revert ZeroAddress();
        if (frozen[wallet]) revert AlreadyFrozen(wallet);

        frozen[wallet] = true;
        emit WalletFrozenSet(wallet, msg.sender);
    }

    /// @notice Lifts a freeze previously set by an agent.
    function unfreezeWallet(address wallet) external onlyRole(AGENT_ROLE) {
        if (wallet == address(0)) revert ZeroAddress();
        if (!frozen[wallet]) revert NotFrozen(wallet);

        frozen[wallet] = false;
        emit WalletUnfrozenSet(wallet, msg.sender);
    }

    /**
     * @notice Moves `amount` from `from` to `to` without the holder's
     *         signature — used for recovery (key loss, succession) or to
     *         comply with a court order.
     *
     * @dev Skips the freeze check on `from` (recovery from a frozen wallet
     *      is the entire point) but still enforces compliance on `to`, so
     *      the destination must be KYC-verified.
     */
    function forcedTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyRole(AGENT_ROLE) {
        _forcedTransferContext = true;
        _transfer(from, to, amount);
        _forcedTransferContext = false;
        emit ForcedTransferExecuted(from, to, amount, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Transfer hook — single gate every token movement passes through
    // -------------------------------------------------------------------------

    /**
     * @dev Applies, in order: pause → freeze → compliance. Reverts before
     *      mutating any balance if any check fails. Mint sets `from = 0`,
     *      burn sets `to = 0`; the compliance engine handles those cases.
     */
    function _update(address from, address to, uint256 value) internal override whenNotPaused {
        if (!_forcedTransferContext) {
            if (from != address(0) && frozen[from]) revert WalletFrozen(from);
        }
        if (to != address(0) && frozen[to]) revert WalletFrozen(to);

        if (!complianceManager.canTransfer(from, to, value)) {
            revert ComplianceCheckFailed(from, to);
        }

        super._update(from, to, value);

        // Post-transfer hook so stateful modules (e.g. MaxHolders) can
        // update aggregates. Runs after balances are settled.
        complianceManager.moduleAction(from, to, value);
    }
}
