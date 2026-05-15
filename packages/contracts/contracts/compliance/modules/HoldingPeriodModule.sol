// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HoldingPeriodModule
 * @notice Bloquea transferencias hasta que termine el lockup configurado por token.
 */
contract HoldingPeriodModule {
    mapping(address => uint256) public lockupUntil; // token => timestamp

    function setLockup(address token, uint256 until) external {
        // TODO: restringir a admin/owner del token
        lockupUntil[token] = until;
    }

    function canTransfer(address token, address, address, uint256) external view returns (bool) {
        return block.timestamp >= lockupUntil[token];
    }

    function transferred(address, address, address, uint256) external pure {
        // no-op
    }
}
