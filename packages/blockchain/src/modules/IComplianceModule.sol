// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title  IComplianceModule
 * @notice Common interface every compliance module must implement to be
 *         bindable to a {SecurityToken} via {ComplianceManager}.
 *
 *         Two responsibilities per module:
 *
 *           1. {canTransfer} — view check called inside the token's
 *              `_update` hook, before any balance changes. Must be cheap
 *              and side-effect-free.
 *           2. {moduleAction} — state-changing callback invoked after the
 *              transfer succeeds. Used by modules that track aggregate
 *              state (e.g. holder counts).
 *
 *         The `token` parameter identifies which SecurityToken is asking;
 *         modules scope their state per-token, so a single deployment of
 *         e.g. {MaxHoldersModule} can serve every offering on the
 *         platform.
 */
interface IComplianceModule {
    /**
     * @notice Returns whether the module permits the proposed transfer.
     * @param  token  Address of the calling SecurityToken.
     * @param  from   Sender (zero on mint).
     * @param  to     Receiver (zero on burn).
     * @param  amount Transfer amount in token base units.
     */
    function canTransfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);

    /**
     * @notice Notifies the module that a transfer has just executed so it
     *         can update internal aggregates. MUST only be callable by the
     *         module's bound {ComplianceManager}.
     */
    function moduleAction(address token, address from, address to, uint256 amount) external;
}
