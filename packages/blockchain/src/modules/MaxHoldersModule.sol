// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IComplianceModule} from "./IComplianceModule.sol";

/**
 * @title  MaxHoldersModule
 * @notice Enforces a per-token maximum number of concurrent holders.
 *         Implements the CNBV requirement that an IFC offering must not
 *         exceed a configured number of distinct investors.
 *
 * @dev    Holder bookkeeping is maintained in {moduleAction}, which the
 *         {ComplianceManager} calls AFTER the underlying transfer has
 *         settled. Read paths in {canTransfer} project the post-transfer
 *         state from current balances + the inbound amount.
 */
contract MaxHoldersModule is Ownable, IComplianceModule {
    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error OnlyCompliance();

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event MaxHoldersSet(address indexed token, uint256 maxHolders);
    event HolderAdded(address indexed token, address indexed holder);
    event HolderRemoved(address indexed token, address indexed holder);

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice ComplianceManager allowed to call {moduleAction}.
    address public immutable complianceManager;

    /// @notice token => cap on concurrent holders. Zero = unlimited.
    mapping(address => uint256) public maxHolders;

    /// @notice token => current number of distinct holders.
    mapping(address => uint256) public holderCount;

    /// @notice token => address => is currently a holder (balance > 0).
    mapping(address => mapping(address => bool)) public isHolder;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address initialOwner, address complianceManager_) Ownable(initialOwner) {
        if (initialOwner == address(0) || complianceManager_ == address(0)) revert ZeroAddress();
        complianceManager = complianceManager_;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Sets the maximum number of holders for `token`. Zero = unlimited.
    function setMaxHolders(address token, uint256 max) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        maxHolders[token] = max;
        emit MaxHoldersSet(token, max);
    }

    // -------------------------------------------------------------------------
    // IComplianceModule
    // -------------------------------------------------------------------------

    /// @inheritdoc IComplianceModule
    function canTransfer(
        address token,
        address,
        /*from*/ address to,
        uint256 amount
    ) external view returns (bool) {
        // Burn never adds a holder.
        if (to == address(0)) return true;

        uint256 cap = maxHolders[token];
        if (cap == 0) return true; // unlimited

        // If `to` is already a holder, capacity isn't affected.
        if (isHolder[token][to]) return true;

        // Zero-amount transfers don't make anyone a new holder.
        if (amount == 0) return true;

        return holderCount[token] + 1 <= cap;
    }

    /// @inheritdoc IComplianceModule
    function moduleAction(address token, address from, address to, uint256 /*amount*/) external {
        if (msg.sender != complianceManager) revert OnlyCompliance();

        // Sender may have gone to zero — drop from the holder set.
        if (from != address(0) && isHolder[token][from] && IERC20(token).balanceOf(from) == 0) {
            isHolder[token][from] = false;
            unchecked {
                --holderCount[token];
            }
            emit HolderRemoved(token, from);
        }

        // Receiver may have crossed zero — register as holder.
        if (to != address(0) && !isHolder[token][to] && IERC20(token).balanceOf(to) > 0) {
            isHolder[token][to] = true;
            unchecked {
                ++holderCount[token];
            }
            emit HolderAdded(token, to);
        }
    }
}
