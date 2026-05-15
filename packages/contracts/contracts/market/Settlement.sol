// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Settlement
 * @notice Atomic swap entre SecurityToken y stablecoin (USDC) con verificación de compliance.
 *         Recibe órdenes firmadas EIP-712 (matched off-chain) y las ejecuta en una sola tx.
 *         Si compliance falla, la tx revierte; ninguna parte pierde fondos ni tokens.
 */

interface IERC20Min {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract Settlement {
    address public owner;
    address public feeRecipient;
    uint256 public feeBps; // basis points sobre el notional en USDC

    mapping(bytes32 => bool) public executedOrders;

    event TradeExecuted(
        bytes32 indexed buyOrderHash,
        bytes32 indexed sellOrderHash,
        address indexed token,
        address buyer,
        address seller,
        uint256 qty,
        uint256 price,
        uint256 fee
    );

    constructor(address _feeRecipient, uint256 _feeBps) {
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    /// @notice Ejecuta un match. Las firmas EIP-712 ya fueron verificadas off-chain por el matching engine
    ///         (en producción se vuelve a verificar on-chain; aquí placeholder por brevedad).
    function executeMatch(
        address token,
        address stablecoin,
        address buyer,
        address seller,
        uint256 qty,
        uint256 price, // precio total en stablecoin (no por unidad)
        bytes32 buyOrderHash,
        bytes32 sellOrderHash
    ) external {
        require(!executedOrders[buyOrderHash] && !executedOrders[sellOrderHash], "already executed");
        executedOrders[buyOrderHash] = true;
        executedOrders[sellOrderHash] = true;

        uint256 fee = (price * feeBps) / 10000;
        uint256 sellerProceeds = price - fee;

        // Stablecoin: buyer -> seller (menos fee)
        require(IERC20Min(stablecoin).transferFrom(buyer, seller, sellerProceeds), "usdc->seller");
        if (fee > 0) {
            require(IERC20Min(stablecoin).transferFrom(buyer, feeRecipient, fee), "usdc->fee");
        }

        // SecurityToken: seller -> buyer (este transfer aplica todas las reglas de compliance dentro del token)
        require(IERC20Min(token).transferFrom(seller, buyer, qty), "token->buyer");

        emit TradeExecuted(buyOrderHash, sellOrderHash, token, buyer, seller, qty, price, fee);
    }

    function setFee(uint256 _bps, address _recipient) external {
        require(msg.sender == owner, "not owner");
        require(_bps <= 1000, "fee too high");
        feeBps = _bps;
        feeRecipient = _recipient;
    }
}
