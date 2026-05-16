// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  IdentityRegistry
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice On-chain KYC registry. Maps wallets to a verified flag, populated
 *         by an off-chain oracle (the Arkangeles KYC backend) after a user
 *         completes identity verification against a CNBV-aligned provider.
 *
 *         Conceptually this is the lightweight precursor to the ERC-3643
 *         IdentityRegistry: it answers a single question — "is this wallet
 *         allowed to hold or move regulated tokens?" — and is consumed by
 *         {ComplianceManager} during pre-transfer checks.
 *
 * @dev Only the contract owner (the KYC oracle EOA / multisig) can mutate
 *      verification state. Reads are public and gas-cheap so the
 *      ComplianceManager and downstream SecurityToken can branch on them
 *      inside every `transfer`.
 */
contract IdentityRegistry is Ownable {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    /// @notice Thrown when attempting to operate on the zero address.
    error ZeroAddress();

    /// @notice Thrown when verifying a wallet that is already verified.
    error AlreadyVerified(address user);

    /// @notice Thrown when revoking a wallet that is not currently verified.
    error NotVerified(address user);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    /// @notice Emitted when a wallet is marked as KYC-verified.
    event AddressVerified(address indexed user, address indexed verifier);

    /// @notice Emitted when a wallet's verification is revoked.
    event AddressRevoked(address indexed user, address indexed verifier);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @dev wallet => KYC verification flag.
    mapping(address => bool) private _verified;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param initialOwner Address of the KYC oracle (backend signer or
     *                     compliance multisig) that will manage the registry.
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
    }

    // -------------------------------------------------------------------------
    // Write API (oracle-only)
    // -------------------------------------------------------------------------

    /**
     * @notice Marks `user` as KYC-verified. Callable only by the oracle owner.
     * @param  user Wallet of the investor whose identity has been validated
     *              off-chain by Arkangeles' KYC pipeline.
     */
    function verifyAddress(address user) external onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        if (_verified[user]) revert AlreadyVerified(user);

        _verified[user] = true;
        emit AddressVerified(user, msg.sender);
    }

    /**
     * @notice Revokes a previously granted verification (e.g. AML hit, court
     *         order, expired KYC). Callable only by the oracle owner.
     * @param  user Wallet whose verification will be removed.
     */
    function revokeAddress(address user) external onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        if (!_verified[user]) revert NotVerified(user);

        _verified[user] = false;
        emit AddressRevoked(user, msg.sender);
    }

    /**
     * @notice Batch variant of {verifyAddress} for onboarding multiple
     *         investors in a single transaction. Skips entries that are
     *         already verified instead of reverting the whole batch — this
     *         keeps the oracle idempotent under retries.
     * @param  users Array of wallets to mark as verified.
     */
    function batchVerifyAddresses(address[] calldata users) external onlyOwner {
        uint256 len = users.length;
        for (uint256 i; i < len; ++i) {
            address user = users[i];
            if (user == address(0)) revert ZeroAddress();
            if (_verified[user]) continue;

            _verified[user] = true;
            emit AddressVerified(user, msg.sender);
        }
    }

    // -------------------------------------------------------------------------
    // Read API
    // -------------------------------------------------------------------------

    /**
     * @notice Returns whether `user` currently passes KYC.
     * @param  user Wallet to check.
     * @return True if the wallet is verified and not revoked.
     */
    function isVerified(address user) external view returns (bool) {
        return _verified[user];
    }
}
