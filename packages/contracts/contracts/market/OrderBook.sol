// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title OrderBook
 * @notice Registro on-chain (opcional) de órdenes activas para auditoría regulatoria.
 *         El matching real corre off-chain (gas-eficiente); este contrato existe para
 *         que CNBV pueda inspeccionar el estado del libro en cualquier bloque.
 */
contract OrderBook {
    enum Side { Buy, Sell }
    enum Status { Open, Filled, Cancelled }

    struct Order {
        address maker;
        address token;
        Side side;
        uint256 qty;
        uint256 price;
        uint256 createdAt;
        uint256 expiresAt;
        Status status;
    }

    mapping(bytes32 => Order) public orders;

    event OrderPosted(bytes32 indexed orderHash, address indexed maker, address indexed token, Side side, uint256 qty, uint256 price);
    event OrderCancelled(bytes32 indexed orderHash);
    event OrderFilled(bytes32 indexed orderHash);

    function postOrder(
        bytes32 orderHash,
        address token,
        Side side,
        uint256 qty,
        uint256 price,
        uint256 expiresAt
    ) external {
        require(orders[orderHash].maker == address(0), "exists");
        orders[orderHash] = Order({
            maker: msg.sender,
            token: token,
            side: side,
            qty: qty,
            price: price,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            status: Status.Open
        });
        emit OrderPosted(orderHash, msg.sender, token, side, qty, price);
    }

    function cancelOrder(bytes32 orderHash) external {
        Order storage o = orders[orderHash];
        require(o.maker == msg.sender, "not maker");
        require(o.status == Status.Open, "not open");
        o.status = Status.Cancelled;
        emit OrderCancelled(orderHash);
    }

    function markFilled(bytes32 orderHash) external {
        // TODO: restringir al Settlement
        Order storage o = orders[orderHash];
        require(o.status == Status.Open, "not open");
        o.status = Status.Filled;
        emit OrderFilled(orderHash);
    }
}
