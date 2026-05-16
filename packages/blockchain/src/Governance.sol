// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Minimal surface of AccessControl that Governance needs to verify
 *      that the caller holds DEFAULT_ADMIN_ROLE on a SecurityToken.
 */
interface IAccessControlMinimal {
    function hasRole(bytes32 role, address account) external view returns (bool);
}

/**
 * @title  Governance
 * @author Arkangeles — Mercado Secundario IFC (Avalanche)
 * @notice Allows the issuer admin of a SecurityToken to create on-chain voting
 *         proposals (asambleas, drag-along, statutory changes) and lets token
 *         holders cast weighted votes proportional to their stake at the time
 *         the proposal was declared.
 *
 *         Architecture: push-allocation snapshot + pull-vote.
 *           1. Issuer calls {propose} with the holder list and their weights
 *              (= balances at declaration time). This avoids modifying
 *              SecurityToken to add ERC20Votes/Snapshot (the ARKDEMO contract
 *              is already verified on Snowscan and must not change).
 *           2. Each holder calls {castVote} during the voting period.
 *           3. Anyone calls {finalize} after the deadline to record the outcome.
 *
 * @dev    No Ownable/AccessControl inheritance — authorization is delegated to
 *         the SecurityToken's DEFAULT_ADMIN_ROLE check, so this contract needs
 *         no role management of its own.
 *
 *         DEFAULT_ADMIN_ROLE in OZ AccessControl is bytes32(0).
 *
 *         IMPORTANT — Declarative only: proposals have NO on-chain execution.
 *         A "Passed" outcome is an immutable on-chain record that the issuer /
 *         admin uses off-chain to execute the corporate action (e.g. calling
 *         `forcedTransfer` for drag-along, declaring a dividend, updating a
 *         prospectus). Quorum, voting-power decay, delegation, and on-chain
 *         execution are out of scope for this MVP.
 */
contract Governance is ReentrancyGuard {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    /// @dev OZ AccessControl DEFAULT_ADMIN_ROLE is always bytes32(0).
    bytes32 private constant DEFAULT_ADMIN_ROLE = bytes32(0);

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice The three valid options a holder can choose when voting.
    enum VoteOption {
        Against,
        For,
        Abstain
    }

    /**
     * @notice The lifecycle state of a proposal.
     *
     *   Pending  — created, voting period not yet started (currently unused;
     *              proposals go Active immediately, kept for future use).
     *   Active   — within the voting deadline (returned by {getProposalStatus}).
     *   Passed   — for > against after finalization.
     *   Defeated — against > for after finalization.
     *   Tie      — for == against after finalization. Abstains do not decide.
     *              (Quorum is not enforced in this MVP.)
     */
    enum ProposalStatus {
        Pending,
        Active,
        Passed,
        Defeated,
        Tie
    }

    struct Proposal {
        /// @notice SecurityToken over which the vote is held.
        address token;
        /// @notice Issuer admin that called {propose}.
        address proposedBy;
        /// @notice Human-readable summary. Document hash should be stored off-chain.
        string description;
        /// @notice block.timestamp when the proposal was created.
        uint256 createdAt;
        /// @notice block.timestamp after which no more votes are accepted.
        uint256 votingDeadline;
        /// @notice Sum of all holder weights passed to {propose}.
        uint256 totalVotingPower;
        /// @notice Accumulated weight of For votes.
        uint256 forVotes;
        /// @notice Accumulated weight of Against votes.
        uint256 againstVotes;
        /// @notice Accumulated weight of Abstain votes.
        uint256 abstainVotes;
        /// @notice Number of holders in the snapshot.
        uint256 holderCount;
        /// @notice Final status, set by {finalize}. Pending until finalized.
        ProposalStatus status;
        /// @notice Whether {finalize} has been called on this proposal.
        bool finalized;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice proposalId → Proposal metadata.
    mapping(uint256 => Proposal) public proposals;

    /// @notice proposalId → holder → voting weight assigned at snapshot.
    mapping(uint256 => mapping(address => uint256)) public votingPower;

    /// @notice proposalId → holder → whether the holder has already voted.
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice proposalId → holder → the option the holder chose.
    mapping(uint256 => mapping(address => VoteOption)) public voteOf;

    /// @notice Next proposalId to be assigned (auto-increment, starting at 0).
    uint256 public nextProposalId;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed token,
        address indexed proposedBy,
        string description,
        uint256 votingDeadline,
        uint256 totalVotingPower,
        uint256 holderCount
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteOption support,
        uint256 weight
    );

    event ProposalFinalized(
        uint256 indexed proposalId,
        ProposalStatus status,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NotIssuerAdmin(address token, address caller);
    error EmptyHolderList();
    error ArrayLengthMismatch();
    error ZeroWeight();
    error DuplicateHolder(address holder);
    error EmptyDescription();
    error DeadlineInPast(uint256 votingDeadline);
    error ProposalNotFound(uint256 proposalId);
    error VotingPeriodEnded(uint256 proposalId);
    error VotingPeriodActive(uint256 proposalId);
    error NoVotingPower(uint256 proposalId, address voter);
    error AlreadyVoted(uint256 proposalId, address voter);
    error AlreadyFinalized(uint256 proposalId);

    // -------------------------------------------------------------------------
    // External — write functions
    // -------------------------------------------------------------------------

    /**
     * @notice Creates a new governance proposal for `token`. Caller must hold
     *         DEFAULT_ADMIN_ROLE on `token`. Holders and their weights represent
     *         the snapshot at the time of this call; weights are typically the
     *         token balances of each holder.
     * @param token          Address of the SecurityToken this proposal is for.
     * @param description    Human-readable 1-line summary of the proposal.
     * @param holders        Snapshot list of eligible voter addresses.
     * @param weights        Parallel array of voting weights (token base units).
     * @param votingDeadline Unix timestamp after which no votes are accepted.
     * @return proposalId    Auto-incremental id assigned to this proposal.
     */
    function propose(
        address token,
        string calldata description,
        address[] calldata holders,
        uint256[] calldata weights,
        uint256 votingDeadline
    ) external nonReentrant returns (uint256 proposalId) {
        // --- Input validation ---
        if (token == address(0)) revert ZeroAddress();
        if (bytes(description).length == 0) revert EmptyDescription();
        if (holders.length == 0) revert EmptyHolderList();
        if (holders.length != weights.length) revert ArrayLengthMismatch();
        if (votingDeadline <= block.timestamp) revert DeadlineInPast(votingDeadline);

        // --- Authorization: caller must be DEFAULT_ADMIN_ROLE on the token ---
        if (!IAccessControlMinimal(token).hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotIssuerAdmin(token, msg.sender);
        }

        // Assign the id before incrementing so the first proposal is 0.
        proposalId = nextProposalId;

        // --- Build snapshot and accumulate totalVotingPower ---
        uint256 totalVotingPower = 0;
        uint256 len = holders.length;
        for (uint256 i = 0; i < len; ) {
            address holder = holders[i];
            uint256 weight = weights[i];

            if (holder == address(0)) revert ZeroAddress();
            if (weight == 0) revert ZeroWeight();
            // Detect duplicates: if power already set, holder appears twice.
            if (votingPower[proposalId][holder] != 0) revert DuplicateHolder(holder);

            votingPower[proposalId][holder] = weight;
            totalVotingPower += weight;

            unchecked {
                ++i;
            }
        }

        // --- Persist proposal record ---
        proposals[proposalId] = Proposal({
            token: token,
            proposedBy: msg.sender,
            description: description,
            createdAt: block.timestamp,
            votingDeadline: votingDeadline,
            totalVotingPower: totalVotingPower,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            holderCount: len,
            status: ProposalStatus.Pending,
            finalized: false
        });

        // --- Advance counter ---
        nextProposalId = proposalId + 1;

        emit ProposalCreated(
            proposalId,
            token,
            msg.sender,
            description,
            votingDeadline,
            totalVotingPower,
            len
        );
    }

    /**
     * @notice Cast a vote on an active proposal. Each holder may vote exactly
     *         once. Weight equals the voting power assigned at snapshot time.
     * @param proposalId The id returned by {propose}.
     * @param support    The voter's choice: Against (0), For (1), or Abstain (2).
     */
    function castVote(uint256 proposalId, VoteOption support) external nonReentrant {
        // --- Existence check: uninitialized proposals have token == address(0) ---
        if (proposals[proposalId].token == address(0)) revert ProposalNotFound(proposalId);

        // --- Timing check ---
        if (block.timestamp > proposals[proposalId].votingDeadline) {
            revert VotingPeriodEnded(proposalId);
        }

        // --- Eligibility checks ---
        if (votingPower[proposalId][msg.sender] == 0) {
            revert NoVotingPower(proposalId, msg.sender);
        }
        if (hasVoted[proposalId][msg.sender]) {
            revert AlreadyVoted(proposalId, msg.sender);
        }

        // --- Checks-Effects-Interactions: mark voted first (anti double-vote) ---
        hasVoted[proposalId][msg.sender] = true;
        voteOf[proposalId][msg.sender] = support;

        uint256 weight = votingPower[proposalId][msg.sender];

        if (support == VoteOption.For) {
            proposals[proposalId].forVotes += weight;
        } else if (support == VoteOption.Against) {
            proposals[proposalId].againstVotes += weight;
        } else {
            // VoteOption.Abstain
            proposals[proposalId].abstainVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @notice Closes a proposal after its deadline and records the final outcome.
     *         Can be called by anyone — the outcome is determined solely by the
     *         accumulated votes, not by the caller. Safe to call multiple times
     *         (reverts on second call via {AlreadyFinalized}).
     *
     *         Outcome rules (simple majority of For vs Against; abstains do not
     *         decide and quorum is not enforced in this MVP):
     *           forVotes > againstVotes  → Passed
     *           againstVotes > forVotes  → Defeated
     *           forVotes == againstVotes → Tie
     *
     * @param proposalId The id returned by {propose}.
     */
    function finalize(uint256 proposalId) external nonReentrant {
        // --- Existence check ---
        if (proposals[proposalId].token == address(0)) revert ProposalNotFound(proposalId);

        // --- Timing check ---
        if (block.timestamp <= proposals[proposalId].votingDeadline) {
            revert VotingPeriodActive(proposalId);
        }

        // --- Idempotency guard ---
        if (proposals[proposalId].finalized) revert AlreadyFinalized(proposalId);

        // --- Compute outcome ---
        ProposalStatus outcome = _computeOutcome(
            proposals[proposalId].forVotes,
            proposals[proposalId].againstVotes
        );

        // --- Write result ---
        proposals[proposalId].finalized = true;
        proposals[proposalId].status = outcome;

        emit ProposalFinalized(
            proposalId,
            outcome,
            proposals[proposalId].forVotes,
            proposals[proposalId].againstVotes,
            proposals[proposalId].abstainVotes
        );
    }

    // -------------------------------------------------------------------------
    // External — view functions
    // -------------------------------------------------------------------------

    /**
     * @notice Returns the current effective status of a proposal without
     *         mutating state. Useful for frontends to display "Aprobada
     *         (pendiente de cerrar)" before someone calls {finalize}.
     *
     *         Logic:
     *           - Reverts with {ProposalNotFound} if the proposal does not exist.
     *           - Returns the stored status if already finalized.
     *           - Returns Active if the voting deadline has not passed yet.
     *           - Computes and returns the would-be outcome (Passed/Defeated/Tie)
     *             if the deadline has passed but {finalize} has not been called.
     *
     * @param proposalId The id returned by {propose}.
     * @return           The current effective ProposalStatus.
     */
    function getProposalStatus(uint256 proposalId) external view returns (ProposalStatus) {
        if (proposals[proposalId].token == address(0)) revert ProposalNotFound(proposalId);

        if (proposals[proposalId].finalized) {
            return proposals[proposalId].status;
        }

        if (block.timestamp <= proposals[proposalId].votingDeadline) {
            return ProposalStatus.Active;
        }

        // Deadline passed, not yet finalized — compute what finalize would return.
        return _computeOutcome(proposals[proposalId].forVotes, proposals[proposalId].againstVotes);
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * @dev Pure helper: derive Passed/Defeated/Tie from raw vote tallies.
     *      Abstains are excluded from this computation by design (no quorum MVP).
     */
    function _computeOutcome(
        uint256 forVotes,
        uint256 againstVotes
    ) internal pure returns (ProposalStatus) {
        if (forVotes > againstVotes) return ProposalStatus.Passed;
        if (againstVotes > forVotes) return ProposalStatus.Defeated;
        return ProposalStatus.Tie;
    }
}
