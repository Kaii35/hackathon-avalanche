// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Minimal surface of AccessControl that DividendDistributor needs to
 *      verify that the caller holds DEFAULT_ADMIN_ROLE on a SecurityToken.
 */
interface IAccessControlMinimal {
    function hasRole(bytes32 role, address account) external view returns (bool);
}

/**
 * @title  DividendDistributor
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice Allows the issuer admin of a SecurityToken to declare a USDC
 *         dividend distribution with explicit per-holder allocations.
 *
 *         Architecture: push-allocation + pull-claim.
 *           1. Issuer calls {declare} with holders and amounts arrays.
 *           2. Contract pulls the total USDC from the issuer (requires prior
 *              ERC-20 approval).
 *           3. Each holder calls {claim} independently to receive their share.
 *
 * @dev    No Ownable/AccessControl inheritance — authorization is delegated to
 *         the SecurityToken's DEFAULT_ADMIN_ROLE check, so the contract itself
 *         needs no role management.
 *
 *         DEFAULT_ADMIN_ROLE in OZ AccessControl is bytes32(0).
 *         We hardcode that value rather than calling the token to avoid an
 *         extra external call and a potential interface mismatch.
 */
contract DividendDistributor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @dev OZ AccessControl DEFAULT_ADMIN_ROLE is always bytes32(0).
    bytes32 private constant DEFAULT_ADMIN_ROLE = bytes32(0);

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct Dividend {
        /// @notice Address of the SecurityToken this distribution is for.
        address token;
        /// @notice ERC-20 payment token (e.g. USDC) held by this contract.
        address paymentToken;
        /// @notice Issuer admin that called {declare}.
        address declaredBy;
        /// @notice Sum of all holder allocations in paymentToken base units.
        uint256 totalAmount;
        /// @notice Running total of USDC that has been claimed so far.
        uint256 totalClaimed;
        /// @notice Block timestamp at declaration time.
        uint256 declaredAt;
        /// @notice Number of holders in this distribution.
        uint256 holderCount;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice dividendId → Dividend metadata.
    mapping(uint256 => Dividend) public dividends;

    /// @notice dividendId → holder → allocated amount in paymentToken base units.
    mapping(uint256 => mapping(address => uint256)) public allocation;

    /// @notice dividendId → holder → whether the holder has claimed.
    mapping(uint256 => mapping(address => bool)) public claimed;

    /// @notice Next dividend id to be assigned (auto-increment starting at 0).
    uint256 public nextDividendId;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event DividendDeclared(
        uint256 indexed dividendId,
        address indexed token,
        address indexed paymentToken,
        address declaredBy,
        uint256 totalAmount,
        uint256 holderCount
    );

    event DividendClaimed(uint256 indexed dividendId, address indexed holder, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NotIssuerAdmin(address token, address caller);
    error EmptyHolderList();
    error ArrayLengthMismatch();
    error ZeroAmount();
    error DuplicateHolder(address holder);
    error DividendNotFound(uint256 dividendId);
    error NotAllocated(uint256 dividendId, address holder);
    error AlreadyClaimed(uint256 dividendId, address holder);

    // -------------------------------------------------------------------------
    // External functions
    // -------------------------------------------------------------------------

    /**
     * @notice Declares a new dividend distribution. Caller must have
     *         DEFAULT_ADMIN_ROLE on the SecurityToken being distributed for.
     *         Caller must have approved this contract for at least
     *         sum(amounts) of paymentToken before calling.
     * @param token        Address of the SecurityToken whose holders receive dividends.
     * @param paymentToken ERC-20 token used for payment (e.g. USDC).
     * @param holders      Ordered list of beneficiary addresses.
     * @param amounts      Parallel list of amounts in paymentToken base units.
     * @return dividendId  The id assigned to this dividend (0-indexed, auto-increment).
     */
    function declare(
        address token,
        address paymentToken,
        address[] calldata holders,
        uint256[] calldata amounts
    ) external nonReentrant returns (uint256 dividendId) {
        // --- Input validation ---
        if (token == address(0) || paymentToken == address(0)) revert ZeroAddress();
        if (holders.length == 0) revert EmptyHolderList();
        if (holders.length != amounts.length) revert ArrayLengthMismatch();

        // --- Authorization: caller must be DEFAULT_ADMIN_ROLE on the token ---
        if (!IAccessControlMinimal(token).hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotIssuerAdmin(token, msg.sender);
        }

        // Assign the id before incrementing so the first dividend is 0.
        dividendId = nextDividendId;

        // --- Build allocation map and accumulate total ---
        uint256 totalAmount = 0;
        uint256 len = holders.length;
        for (uint256 i = 0; i < len; ) {
            address holder = holders[i];
            uint256 amount = amounts[i];

            if (holder == address(0)) revert ZeroAddress();
            if (amount == 0) revert ZeroAmount();
            // Detect duplicates: if allocation already set, holder appears twice.
            if (allocation[dividendId][holder] != 0) revert DuplicateHolder(holder);

            allocation[dividendId][holder] = amount;
            totalAmount += amount;

            unchecked {
                ++i;
            }
        }

        // --- Pull USDC from issuer (requires prior approve) ---
        IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), totalAmount);

        // --- Persist dividend record ---
        dividends[dividendId] = Dividend({
            token: token,
            paymentToken: paymentToken,
            declaredBy: msg.sender,
            totalAmount: totalAmount,
            totalClaimed: 0,
            declaredAt: block.timestamp,
            holderCount: len
        });

        // --- Advance counter ---
        nextDividendId = dividendId + 1;

        emit DividendDeclared(dividendId, token, paymentToken, msg.sender, totalAmount, len);
    }

    /**
     * @notice Holder claims their allocation for a given dividendId.
     *         Reverts if the dividend does not exist, the caller has no
     *         allocation, or the caller has already claimed.
     * @param dividendId The id returned by {declare}.
     */
    function claim(uint256 dividendId) external nonReentrant {
        // Dividend existence check: token is zero-address for uninitialised slots.
        if (dividends[dividendId].token == address(0)) revert DividendNotFound(dividendId);

        uint256 amount = allocation[dividendId][msg.sender];
        if (amount == 0) revert NotAllocated(dividendId, msg.sender);
        if (claimed[dividendId][msg.sender]) revert AlreadyClaimed(dividendId, msg.sender);

        // --- Checks-Effects-Interactions ---
        claimed[dividendId][msg.sender] = true;
        dividends[dividendId].totalClaimed += amount;

        address paymentToken = dividends[dividendId].paymentToken;
        IERC20(paymentToken).safeTransfer(msg.sender, amount);

        emit DividendClaimed(dividendId, msg.sender, amount);
    }

    /**
     * @notice Returns how much paymentToken `holder` can still claim from
     *         `dividendId`. Returns 0 if the dividend does not exist, the
     *         holder was not allocated, or the holder has already claimed.
     * @param dividendId The id returned by {declare}.
     * @param holder     The beneficiary address to query.
     * @return           Claimable amount in paymentToken base units.
     */
    function claimable(uint256 dividendId, address holder) external view returns (uint256) {
        // Non-existent dividend.
        if (dividends[dividendId].token == address(0)) return 0;
        // Already claimed.
        if (claimed[dividendId][holder]) return 0;
        // Not allocated.
        return allocation[dividendId][holder];
    }
}
