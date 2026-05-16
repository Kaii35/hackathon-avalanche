// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title  MockUSDC
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice Testnet stand-in for USDC. Six decimals to match the real asset.
 *         Public mint so anyone can fund a demo wallet — DO NOT deploy to
 *         mainnet.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    /// @notice USDC's native precision (6 decimals).
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mints `amount` (in 6-decimal base units) to `to`. Testnet only.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
