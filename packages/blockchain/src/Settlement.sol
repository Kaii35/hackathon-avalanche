// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title  Settlement
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice Atomic on-chain settlement of off-chain matched orders. Both sides
 *         of a trade are EIP-712 signed limit orders. The platform's matcher
 *         submits a pair (one buy, one sell) plus a fill quantity; the
 *         contract verifies signatures, validates the price cross, then
 *         performs the token-vs-USDC swap atomically — including the
 *         compliance check baked into {SecurityToken}.
 *
 *         Settlement holds NO custody. It relies on two ERC-20 approvals:
 *           - Seller approves Settlement to spend their SecurityToken.
 *           - Buyer  approves Settlement to spend their payment token (USDC).
 *
 *         If the token leg fails compliance (e.g. the buyer was just
 *         revoked) the entire transaction reverts — no half-settled trades.
 *
 * @dev Pricing convention: `price` is denominated in payment-token base
 *      units per ONE WHOLE security token (i.e. per `10**tokenDecimals`).
 *      For a security token with 18 decimals and USDC with 6 decimals,
 *      `price = 10_000_000` means 10 USDC per share. The execution price
 *      is the seller's ask (maker pricing) — buyers always benefit if
 *      their bid was above the ask.
 */
contract Settlement is EIP712, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @notice Role allowed to call {executeMatch}. Held by the platform's
    ///         matching engine operator (a backend signer or multisig).
    bytes32 public constant MATCHER_ROLE = keccak256("MATCHER_ROLE");

    /// @notice EIP-712 type hash for {Order}.
    bytes32 public constant ORDER_TYPEHASH =
        keccak256(
            "Order(address maker,address token,address paymentToken,uint8 side,uint256 qty,uint256 price,uint256 expiresAt,uint256 salt)"
        );

    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Hard cap on the protocol fee — 5%. Prevents an admin from
    ///         silently turning the platform into a tax farm.
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Scaling factor matching the assumed 18-decimal SecurityToken.
    uint256 private constant TOKEN_PRECISION = 1e18;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum Side {
        Buy,
        Sell
    }

    struct Order {
        address maker;
        address token; // SecurityToken being traded
        address paymentToken; // Payment leg (USDC)
        Side side;
        uint256 qty; // Token base units
        uint256 price; // Payment base units per ONE WHOLE token
        uint256 expiresAt; // Unix seconds
        uint256 salt; // Uniqueness — prevents hash collision on identical limit orders
    }

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error FeeTooHigh();
    error WrongSide();
    error TokenMismatch();
    error PaymentTokenMismatch();
    error OrderExpired();
    error PriceCrossInvalid();
    error InvalidBuySignature();
    error InvalidSellSignature();
    error OrderAlreadyCancelled(bytes32 orderHash);
    error InvalidFillQty();
    error NotMaker();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TradeExecuted(
        bytes32 indexed buyOrderHash,
        bytes32 indexed sellOrderHash,
        address indexed buyer,
        address seller,
        address token,
        address paymentToken,
        uint256 fillQty,
        uint256 executionPrice,
        uint256 paymentAmount,
        uint256 fee
    );
    event OrderCancelled(bytes32 indexed orderHash, address indexed maker);
    event FeeUpdated(uint256 previousBps, uint256 newBps, address indexed recipient);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice orderHash => quantity already filled (in token base units).
    mapping(bytes32 => uint256) public filled;

    /// @notice orderHash => maker has cancelled the order on-chain.
    mapping(bytes32 => bool) public cancelled;

    /// @notice Protocol fee in basis points, charged on the USDC leg.
    uint256 public feeBps;

    /// @notice Recipient of the protocol fee (platform treasury).
    address public feeRecipient;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param admin          Receives DEFAULT_ADMIN_ROLE. Can adjust fee and
     *                       grant/revoke MATCHER_ROLE.
     * @param matcher        Initial backend operator allowed to settle trades.
     * @param feeRecipient_  Platform treasury that receives fees.
     * @param feeBps_        Initial fee in basis points (max {MAX_FEE_BPS}).
     */
    constructor(
        address admin,
        address matcher,
        address feeRecipient_,
        uint256 feeBps_
    ) EIP712("ArkangelesSettlement", "1") {
        if (admin == address(0) || matcher == address(0) || feeRecipient_ == address(0)) {
            revert ZeroAddress();
        }
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MATCHER_ROLE, matcher);

        feeRecipient = feeRecipient_;
        feeBps = feeBps_;
        emit FeeUpdated(0, feeBps_, feeRecipient_);
    }

    // -------------------------------------------------------------------------
    // EIP-712 helpers
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the EIP-712 digest of `order` — the exact value the
     *         maker must sign for the order to be accepted on-chain.
     */
    function hashOrder(Order calldata order) public view returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        ORDER_TYPEHASH,
                        order.maker,
                        order.token,
                        order.paymentToken,
                        uint8(order.side),
                        order.qty,
                        order.price,
                        order.expiresAt,
                        order.salt
                    )
                )
            );
    }

    /// @notice Exposes the EIP-712 domain separator (useful for off-chain SDKs).
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // -------------------------------------------------------------------------
    // Settlement
    // -------------------------------------------------------------------------

    /**
     * @notice Settles a matched pair of orders for `fillQty` units.
     *
     * @dev Order of operations: validate → recover signatures → debit `filled`
     *      counters → perform token leg (compliance enforced) → perform USDC
     *      leg → emit event. Failure at any step reverts the whole tx.
     *
     * @param buy      Buy-side order (counterparty pays USDC, receives token).
     * @param buySig   EIP-712 signature from `buy.maker` over `hashOrder(buy)`.
     * @param sell     Sell-side order (counterparty delivers token, receives USDC).
     * @param sellSig  EIP-712 signature from `sell.maker` over `hashOrder(sell)`.
     * @param fillQty  Quantity (token base units) to settle this call.
     */
    function executeMatch(
        Order calldata buy,
        bytes calldata buySig,
        Order calldata sell,
        bytes calldata sellSig,
        uint256 fillQty
    ) external nonReentrant onlyRole(MATCHER_ROLE) {
        // Order shape
        if (buy.side != Side.Buy || sell.side != Side.Sell) revert WrongSide();
        if (buy.token != sell.token) revert TokenMismatch();
        if (buy.paymentToken != sell.paymentToken) revert PaymentTokenMismatch();
        if (block.timestamp > buy.expiresAt || block.timestamp > sell.expiresAt)
            revert OrderExpired();
        if (buy.price < sell.price) revert PriceCrossInvalid();

        // Signature & cancellation checks
        bytes32 buyHash = hashOrder(buy);
        bytes32 sellHash = hashOrder(sell);
        if (cancelled[buyHash]) revert OrderAlreadyCancelled(buyHash);
        if (cancelled[sellHash]) revert OrderAlreadyCancelled(sellHash);
        if (ECDSA.recover(buyHash, buySig) != buy.maker) revert InvalidBuySignature();
        if (ECDSA.recover(sellHash, sellSig) != sell.maker) revert InvalidSellSignature();

        // Capacity
        uint256 buyRemaining = buy.qty - filled[buyHash];
        uint256 sellRemaining = sell.qty - filled[sellHash];
        if (fillQty == 0 || fillQty > buyRemaining || fillQty > sellRemaining) {
            revert InvalidFillQty();
        }

        // Update fill counters BEFORE external calls (CEI).
        filled[buyHash] += fillQty;
        filled[sellHash] += fillQty;

        // Execution price is the seller's ask — maker pricing.
        uint256 executionPrice = sell.price;
        uint256 paymentAmount = (fillQty * executionPrice) / TOKEN_PRECISION;
        uint256 fee = (paymentAmount * feeBps) / BPS_DENOMINATOR;
        uint256 sellerProceeds = paymentAmount - fee;

        // Token leg: seller → buyer. Triggers SecurityToken compliance hook.
        IERC20(sell.token).safeTransferFrom(sell.maker, buy.maker, fillQty);

        // Payment leg: buyer → seller (and optional fee → treasury).
        IERC20(buy.paymentToken).safeTransferFrom(buy.maker, sell.maker, sellerProceeds);
        if (fee > 0) {
            IERC20(buy.paymentToken).safeTransferFrom(buy.maker, feeRecipient, fee);
        }

        emit TradeExecuted(
            buyHash,
            sellHash,
            buy.maker,
            sell.maker,
            sell.token,
            buy.paymentToken,
            fillQty,
            executionPrice,
            paymentAmount,
            fee
        );
    }

    // -------------------------------------------------------------------------
    // Cancellation
    // -------------------------------------------------------------------------

    /**
     * @notice Cancels an order on-chain. Useful if the maker no longer trusts
     *         the off-chain matcher to honour an off-chain cancellation.
     *         Idempotent — re-cancelling a cancelled order is a no-op.
     */
    function cancelOrder(Order calldata order) external {
        if (msg.sender != order.maker) revert NotMaker();

        bytes32 h = hashOrder(order);
        if (!cancelled[h]) {
            cancelled[h] = true;
            emit OrderCancelled(h, msg.sender);
        }
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Updates the protocol fee. Capped at {MAX_FEE_BPS}.
    function setFee(uint256 newBps, address newRecipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (newRecipient == address(0)) revert ZeroAddress();

        uint256 previous = feeBps;
        feeBps = newBps;
        feeRecipient = newRecipient;
        emit FeeUpdated(previous, newBps, newRecipient);
    }
}
