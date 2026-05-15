// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./SecurityToken.sol";

/**
 * @title TokenFactory
 * @notice Despliega un nuevo SecurityToken por cada oferta de la IFC.
 */
contract TokenFactory {
    address public owner;
    address public defaultIdentityRegistry;
    address public defaultCompliance;

    address[] public deployedTokens;

    event TokenDeployed(address indexed token, address indexed issuer, string name, string symbol);

    constructor(address _identityRegistry, address _compliance) {
        owner = msg.sender;
        defaultIdentityRegistry = _identityRegistry;
        defaultCompliance = _compliance;
    }

    function deployToken(
        string calldata name,
        string calldata symbol,
        address issuer
    ) external returns (address) {
        require(msg.sender == owner, "not owner");
        SecurityToken token = new SecurityToken(
            name,
            symbol,
            issuer,
            defaultIdentityRegistry,
            defaultCompliance
        );
        deployedTokens.push(address(token));
        emit TokenDeployed(address(token), issuer, name, symbol);
        return address(token);
    }

    function deployedCount() external view returns (uint256) {
        return deployedTokens.length;
    }
}
