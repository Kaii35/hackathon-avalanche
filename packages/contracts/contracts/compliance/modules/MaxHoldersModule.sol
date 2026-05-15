// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MaxHoldersModule
 * @notice Limita el número máximo de holders por token (regla CNBV de inversionistas por oferta).
 */
contract MaxHoldersModule {
    mapping(address => uint256) public maxHolders;     // token => max
    mapping(address => uint256) public currentHolders; // token => count
    mapping(address => mapping(address => bool)) public isHolder;

    function setMaxHolders(address token, uint256 max) external {
        // TODO: restringir a admin/owner
        maxHolders[token] = max;
    }

    function canTransfer(
        address token,
        address from,
        address to,
        uint256
    ) external view returns (bool) {
        if (isHolder[token][to]) return true;
        if (from == address(0) || !isHolder[token][from]) {
            return currentHolders[token] < maxHolders[token];
        }
        return true;
    }

    function transferred(address token, address from, address to, uint256) external {
        if (!isHolder[token][to]) {
            isHolder[token][to] = true;
            currentHolders[token]++;
        }
        // Tracking de saldo cero queda al SecurityToken vía callback adicional (TODO).
        from; // silence
    }
}
