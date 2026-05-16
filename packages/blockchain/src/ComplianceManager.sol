// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IComplianceModule} from "./modules/IComplianceModule.sol";

/**
 * @dev Minimal external view of {IdentityRegistry} consumed by the
 *      compliance engine.
 */
interface IIdentityRegistry {
    function isVerified(address user) external view returns (bool);
}

/**
 * @title  ComplianceManager
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice Transfer-time compliance engine for regulated security tokens.
 *
 *         Two layers of enforcement on every transfer:
 *
 *           1. Bilateral KYC — both `from` and `to` must be verified in
 *              the linked {IdentityRegistry} (mint/burn skip the zero side).
 *           2. Modular rules — per-token list of {IComplianceModule}
 *              instances, each checked in order; any false aborts the
 *              transfer.
 *
 *         {SecurityToken} calls this contract from inside its `_update`
 *         hook. The token's address is taken from `msg.sender`, so modules
 *         are scoped per offering.
 */
contract ComplianceManager is Ownable {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error ModuleAlreadyBound(address token, address module);
    error ModuleNotBound(address token, address module);

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event IdentityRegistryUpdated(address indexed previous, address indexed current);
    event ModuleBound(address indexed token, address indexed module);
    event ModuleUnbound(address indexed token, address indexed module);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice KYC registry queried on every transfer.
    IIdentityRegistry public identityRegistry;

    /// @dev token => ordered list of bound modules.
    mapping(address => IComplianceModule[]) private _modules;

    /// @notice Quick lookup: is a given module bound to a given token?
    mapping(address => mapping(address => bool)) public isModuleBound;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner, address registryAddress) Ownable(initialOwner) {
        if (initialOwner == address(0) || registryAddress == address(0)) revert ZeroAddress();

        identityRegistry = IIdentityRegistry(registryAddress);
        emit IdentityRegistryUpdated(address(0), registryAddress);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Replaces the linked IdentityRegistry.
    function setIdentityRegistry(address newRegistry) external onlyOwner {
        if (newRegistry == address(0)) revert ZeroAddress();
        address previous = address(identityRegistry);
        identityRegistry = IIdentityRegistry(newRegistry);
        emit IdentityRegistryUpdated(previous, newRegistry);
    }

    /// @notice Attaches `module` to the compliance chain of `token`.
    function bindModule(address token, address module) external onlyOwner {
        if (token == address(0) || module == address(0)) revert ZeroAddress();
        if (isModuleBound[token][module]) revert ModuleAlreadyBound(token, module);

        _modules[token].push(IComplianceModule(module));
        isModuleBound[token][module] = true;
        emit ModuleBound(token, module);
    }

    /// @notice Detaches `module` from the compliance chain of `token`.
    function unbindModule(address token, address module) external onlyOwner {
        if (!isModuleBound[token][module]) revert ModuleNotBound(token, module);

        IComplianceModule[] storage mods = _modules[token];
        uint256 len = mods.length;
        for (uint256 i; i < len; ++i) {
            if (address(mods[i]) == module) {
                mods[i] = mods[len - 1];
                mods.pop();
                break;
            }
        }
        isModuleBound[token][module] = false;
        emit ModuleUnbound(token, module);
    }

    // -------------------------------------------------------------------------
    // Read API
    // -------------------------------------------------------------------------

    /// @notice Returns the ordered list of module addresses bound to `token`.
    function modulesOf(address token) external view returns (address[] memory out) {
        IComplianceModule[] memory mods = _modules[token];
        out = new address[](mods.length);
        for (uint256 i; i < mods.length; ++i) {
            out[i] = address(mods[i]);
        }
    }

    // -------------------------------------------------------------------------
    // Compliance check (called from SecurityToken._update)
    // -------------------------------------------------------------------------

    /**
     * @notice Returns whether a transfer from `from` to `to` of `amount`
     *         units is permitted. Bilateral KYC + every bound module.
     *
     * @dev    `msg.sender` is interpreted as the calling SecurityToken so
     *         modules are scoped per-offering.
     */
    function canTransfer(address from, address to, uint256 amount) external view returns (bool) {
        IIdentityRegistry registry = identityRegistry;

        if (from != address(0) && !registry.isVerified(from)) return false;
        if (to != address(0) && !registry.isVerified(to)) return false;

        IComplianceModule[] memory mods = _modules[msg.sender];
        uint256 len = mods.length;
        for (uint256 i; i < len; ++i) {
            if (!mods[i].canTransfer(msg.sender, from, to, amount)) return false;
        }
        return true;
    }

    /**
     * @notice Post-transfer hook. Iterates every module bound to the
     *         calling token so stateful modules can update their
     *         aggregates (e.g. holder count). Reverts if any module's
     *         action reverts.
     */
    function moduleAction(address from, address to, uint256 amount) external {
        IComplianceModule[] memory mods = _modules[msg.sender];
        uint256 len = mods.length;
        for (uint256 i; i < len; ++i) {
            mods[i].moduleAction(msg.sender, from, to, amount);
        }
    }
}
