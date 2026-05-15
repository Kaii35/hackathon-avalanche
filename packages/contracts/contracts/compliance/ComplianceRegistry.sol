// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ComplianceRegistry
 * @notice Orquesta los módulos de compliance asociados a un SecurityToken.
 *         Cada token tiene su propia configuración de módulos (lockup, max holders, etc.).
 */
interface IComplianceModule {
    function canTransfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool);

    function transferred(address token, address from, address to, uint256 amount) external;
}

contract ComplianceRegistry {
    mapping(address => address[]) public modulesByToken;
    address public owner;

    event ModuleAdded(address indexed token, address indexed module);
    event ModuleRemoved(address indexed token, address indexed module);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addModule(address token, address module) external onlyOwner {
        modulesByToken[token].push(module);
        emit ModuleAdded(token, module);
    }

    function removeModule(address token, uint256 index) external onlyOwner {
        address[] storage mods = modulesByToken[token];
        require(index < mods.length, "out of range");
        address removed = mods[index];
        mods[index] = mods[mods.length - 1];
        mods.pop();
        emit ModuleRemoved(token, removed);
    }

    function canTransfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) external view returns (bool) {
        address[] storage mods = modulesByToken[token];
        for (uint256 i = 0; i < mods.length; i++) {
            if (!IComplianceModule(mods[i]).canTransfer(token, from, to, amount)) {
                return false;
            }
        }
        return true;
    }

    function notifyTransfer(address from, address to, uint256 amount) external {
        // Solo el SecurityToken debería invocar esto.
        address[] storage mods = modulesByToken[msg.sender];
        for (uint256 i = 0; i < mods.length; i++) {
            IComplianceModule(mods[i]).transferred(msg.sender, from, to, amount);
        }
    }
}
