// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Governance} from "../src/Governance.sol";
import {SecurityToken} from "../src/SecurityToken.sol";
import {ComplianceManager} from "../src/ComplianceManager.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

contract GovernanceTest is Test {
    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------

    Governance internal gov;
    SecurityToken internal token;
    ComplianceManager internal compliance;
    IdentityRegistry internal registry;

    // -------------------------------------------------------------------------
    // Actors
    // -------------------------------------------------------------------------

    address internal oracle = makeAddr("oracle");
    address internal admin = makeAddr("admin"); // ComplianceManager owner
    address internal issuer = makeAddr("issuer"); // DEFAULT_ADMIN_ROLE on token

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal mallory = makeAddr("mallory"); // not an issuer admin

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 internal constant DEFAULT_ADMIN_ROLE = bytes32(0);

    // Voting weights for 3-holder scenarios (token base units)
    uint256 internal constant ALICE_WEIGHT = 60e18;
    uint256 internal constant BOB_WEIGHT = 25e18;
    uint256 internal constant CAROL_WEIGHT = 15e18;
    uint256 internal constant TOTAL_WEIGHT = ALICE_WEIGHT + BOB_WEIGHT + CAROL_WEIGHT;

    // Deadline helpers
    uint256 internal constant VOTING_PERIOD = 3 days;

    // -------------------------------------------------------------------------
    // setUp
    // -------------------------------------------------------------------------

    function setUp() public {
        // Deploy identity + compliance infrastructure (mirrors DividendDistributor tests)
        registry = new IdentityRegistry(oracle);
        compliance = new ComplianceManager(admin, address(registry));

        // Deploy token — issuer receives DEFAULT_ADMIN_ROLE
        token = new SecurityToken("Arkangeles Oferta Demo", "ARKDEMO", issuer, address(compliance));

        // Verify all actors so compliance checks pass on any future transfers
        vm.startPrank(oracle);
        registry.verifyAddress(alice);
        registry.verifyAddress(bob);
        registry.verifyAddress(carol);
        registry.verifyAddress(mallory);
        vm.stopPrank();

        // Deploy governance contract under test
        gov = new Governance();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// @dev Returns the canonical 3-holder arrays used across many tests.
    function _threeHolders()
        internal
        view
        returns (address[] memory holders, uint256[] memory weights)
    {
        holders = new address[](3);
        holders[0] = alice;
        holders[1] = bob;
        holders[2] = carol;

        weights = new uint256[](3);
        weights[0] = ALICE_WEIGHT;
        weights[1] = BOB_WEIGHT;
        weights[2] = CAROL_WEIGHT;
    }

    /// @dev Creates a proposal with the default 3 holders. Returns proposalId.
    function _proposeDefault() internal returns (uint256 proposalId) {
        (address[] memory holders, uint256[] memory weights) = _threeHolders();
        vm.prank(issuer);
        proposalId = gov.propose(
            address(token),
            "Aprobacion de drag-along Arkangeles Serie A",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
    }

    // =========================================================================
    // 1. propose — happy path (3 holders, event emitted, totalVotingPower correct)
    // =========================================================================

    function test_propose_HappyPath_ThreeHolders() public {
        (address[] memory holders, uint256[] memory weights) = _threeHolders();

        uint256 deadline = block.timestamp + VOTING_PERIOD;
        string memory desc = "Aprobacion de drag-along Arkangeles Serie A";

        vm.expectEmit(true, true, true, true);
        emit Governance.ProposalCreated(0, address(token), issuer, desc, deadline, TOTAL_WEIGHT, 3);

        vm.prank(issuer);
        uint256 id = gov.propose(address(token), desc, holders, weights, deadline);

        // Returned id must be 0 (first ever proposal)
        assertEq(id, 0);
        assertEq(gov.nextProposalId(), 1);

        // Proposal metadata
        (
            address storedToken,
            address proposedBy,
            string memory storedDesc,
            uint256 createdAt,
            uint256 storedDeadline,
            uint256 totalVotingPower,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            uint256 holderCount,
            Governance.ProposalStatus status,
            bool finalized
        ) = gov.proposals(id);

        assertEq(storedToken, address(token));
        assertEq(proposedBy, issuer);
        assertEq(storedDesc, desc);
        assertEq(createdAt, block.timestamp);
        assertEq(storedDeadline, deadline);
        assertEq(totalVotingPower, TOTAL_WEIGHT);
        assertEq(forVotes, 0);
        assertEq(againstVotes, 0);
        assertEq(abstainVotes, 0);
        assertEq(holderCount, 3);
        assertEq(uint256(status), uint256(Governance.ProposalStatus.Pending));
        assertFalse(finalized);

        // Per-holder voting power stored correctly
        assertEq(gov.votingPower(id, alice), ALICE_WEIGHT);
        assertEq(gov.votingPower(id, bob), BOB_WEIGHT);
        assertEq(gov.votingPower(id, carol), CAROL_WEIGHT);
    }

    // =========================================================================
    // 2. propose — reverts if caller is not DEFAULT_ADMIN_ROLE on token
    // =========================================================================

    function test_RevertWhen_NotIssuerAdmin() public {
        (address[] memory holders, uint256[] memory weights) = _threeHolders();

        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(Governance.NotIssuerAdmin.selector, address(token), mallory)
        );
        gov.propose(
            address(token),
            "some proposal",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
    }

    // =========================================================================
    // 3. propose — reverts on empty description
    // =========================================================================

    function test_RevertWhen_EmptyDescription() public {
        (address[] memory holders, uint256[] memory weights) = _threeHolders();

        vm.prank(issuer);
        vm.expectRevert(Governance.EmptyDescription.selector);
        gov.propose(address(token), "", holders, weights, block.timestamp + VOTING_PERIOD);
    }

    // =========================================================================
    // 4. propose — reverts on empty holder list
    // =========================================================================

    function test_RevertWhen_EmptyHolderList() public {
        address[] memory holders = new address[](0);
        uint256[] memory weights = new uint256[](0);

        vm.prank(issuer);
        vm.expectRevert(Governance.EmptyHolderList.selector);
        gov.propose(
            address(token),
            "some proposal",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
    }

    // =========================================================================
    // 5. propose — reverts on array length mismatch
    // =========================================================================

    function test_RevertWhen_ArrayLengthMismatch() public {
        address[] memory holders = new address[](2);
        holders[0] = alice;
        holders[1] = bob;

        uint256[] memory weights = new uint256[](1);
        weights[0] = ALICE_WEIGHT;

        vm.prank(issuer);
        vm.expectRevert(Governance.ArrayLengthMismatch.selector);
        gov.propose(
            address(token),
            "some proposal",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
    }

    // =========================================================================
    // 6. propose — reverts on deadline in past (or equal to current timestamp)
    // =========================================================================

    function test_RevertWhen_DeadlineInPast() public {
        (address[] memory holders, uint256[] memory weights) = _threeHolders();

        uint256 badDeadline = block.timestamp; // not strictly > block.timestamp

        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(Governance.DeadlineInPast.selector, badDeadline));
        gov.propose(address(token), "some proposal", holders, weights, badDeadline);
    }

    // =========================================================================
    // 7. propose — reverts on zero address holder
    // =========================================================================

    function test_RevertWhen_ZeroAddressHolder() public {
        address[] memory holders = new address[](2);
        holders[0] = alice;
        holders[1] = address(0); // bad

        uint256[] memory weights = new uint256[](2);
        weights[0] = ALICE_WEIGHT;
        weights[1] = BOB_WEIGHT;

        vm.prank(issuer);
        vm.expectRevert(Governance.ZeroAddress.selector);
        gov.propose(
            address(token),
            "some proposal",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
    }

    // =========================================================================
    // 8. propose — reverts on zero weight
    // =========================================================================

    function test_RevertWhen_ZeroWeight() public {
        address[] memory holders = new address[](2);
        holders[0] = alice;
        holders[1] = bob;

        uint256[] memory weights = new uint256[](2);
        weights[0] = ALICE_WEIGHT;
        weights[1] = 0; // bad

        vm.prank(issuer);
        vm.expectRevert(Governance.ZeroWeight.selector);
        gov.propose(
            address(token),
            "some proposal",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
    }

    // =========================================================================
    // 9. propose — reverts on duplicate holder
    // =========================================================================

    function test_RevertWhen_DuplicateHolder() public {
        address[] memory holders = new address[](3);
        holders[0] = alice;
        holders[1] = bob;
        holders[2] = alice; // duplicate

        uint256[] memory weights = new uint256[](3);
        weights[0] = ALICE_WEIGHT;
        weights[1] = BOB_WEIGHT;
        weights[2] = CAROL_WEIGHT;

        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(Governance.DuplicateHolder.selector, alice));
        gov.propose(
            address(token),
            "some proposal",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
    }

    // =========================================================================
    // 10. castVote — happy path For
    // =========================================================================

    function test_castVote_HappyPath_For() public {
        uint256 id = _proposeDefault();

        vm.expectEmit(true, true, false, true);
        emit Governance.VoteCast(id, alice, Governance.VoteOption.For, ALICE_WEIGHT);

        vm.prank(alice);
        gov.castVote(id, Governance.VoteOption.For);

        // forVotes accumulated
        (, , , , , , uint256 forVotes, , , , , ) = gov.proposals(id);
        assertEq(forVotes, ALICE_WEIGHT);

        // hasVoted and voteOf recorded
        assertTrue(gov.hasVoted(id, alice));
        assertEq(uint256(gov.voteOf(id, alice)), uint256(Governance.VoteOption.For));
    }

    // =========================================================================
    // 11. castVote — happy path Against
    // =========================================================================

    function test_castVote_HappyPath_Against() public {
        uint256 id = _proposeDefault();

        vm.expectEmit(true, true, false, true);
        emit Governance.VoteCast(id, bob, Governance.VoteOption.Against, BOB_WEIGHT);

        vm.prank(bob);
        gov.castVote(id, Governance.VoteOption.Against);

        (, , , , , , , uint256 againstVotes, , , , ) = gov.proposals(id);
        assertEq(againstVotes, BOB_WEIGHT);

        assertTrue(gov.hasVoted(id, bob));
        assertEq(uint256(gov.voteOf(id, bob)), uint256(Governance.VoteOption.Against));
    }

    // =========================================================================
    // 12. castVote — happy path Abstain
    // =========================================================================

    function test_castVote_HappyPath_Abstain() public {
        uint256 id = _proposeDefault();

        vm.expectEmit(true, true, false, true);
        emit Governance.VoteCast(id, carol, Governance.VoteOption.Abstain, CAROL_WEIGHT);

        vm.prank(carol);
        gov.castVote(id, Governance.VoteOption.Abstain);

        (, , , , , , , , uint256 abstainVotes, , , ) = gov.proposals(id);
        assertEq(abstainVotes, CAROL_WEIGHT);

        assertTrue(gov.hasVoted(id, carol));
        assertEq(uint256(gov.voteOf(id, carol)), uint256(Governance.VoteOption.Abstain));
    }

    // =========================================================================
    // 13. castVote — reverts if proposal not found
    // =========================================================================

    function test_castVote_RevertWhen_ProposalNotFound() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Governance.ProposalNotFound.selector, 999));
        gov.castVote(999, Governance.VoteOption.For);
    }

    // =========================================================================
    // 14. castVote — reverts if voting deadline has passed (vm.warp)
    // =========================================================================

    function test_castVote_RevertWhen_VotingPeriodEnded() public {
        uint256 id = _proposeDefault();

        // Advance past the deadline
        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Governance.VotingPeriodEnded.selector, id));
        gov.castVote(id, Governance.VoteOption.For);
    }

    // =========================================================================
    // 15. castVote — reverts if holder has no voting power
    // =========================================================================

    function test_castVote_RevertWhen_NoVotingPower() public {
        uint256 id = _proposeDefault();

        // mallory was not in the holder snapshot
        vm.prank(mallory);
        vm.expectRevert(abi.encodeWithSelector(Governance.NoVotingPower.selector, id, mallory));
        gov.castVote(id, Governance.VoteOption.For);
    }

    // =========================================================================
    // 16. castVote — reverts if holder already voted
    // =========================================================================

    function test_castVote_RevertWhen_AlreadyVoted() public {
        uint256 id = _proposeDefault();

        vm.prank(alice);
        gov.castVote(id, Governance.VoteOption.For);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Governance.AlreadyVoted.selector, id, alice));
        gov.castVote(id, Governance.VoteOption.For);
    }

    // =========================================================================
    // 17. finalize — happy path Passed (For majority)
    // =========================================================================

    function test_finalize_HappyPath_Passed() public {
        uint256 id = _proposeDefault();

        // alice (60) + bob (25) vote For  → 85 For
        // carol (15) votes Against         → 15 Against
        vm.prank(alice);
        gov.castVote(id, Governance.VoteOption.For);
        vm.prank(bob);
        gov.castVote(id, Governance.VoteOption.For);
        vm.prank(carol);
        gov.castVote(id, Governance.VoteOption.Against);

        // Advance past deadline
        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        vm.expectEmit(true, false, false, true);
        emit Governance.ProposalFinalized(
            id,
            Governance.ProposalStatus.Passed,
            ALICE_WEIGHT + BOB_WEIGHT,
            CAROL_WEIGHT,
            0
        );

        gov.finalize(id);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            uint256 forVotes,
            uint256 againstVotes,
            ,
            ,
            Governance.ProposalStatus status,
            bool finalized
        ) = gov.proposals(id);
        assertEq(uint256(status), uint256(Governance.ProposalStatus.Passed));
        assertTrue(finalized);
        assertEq(forVotes, ALICE_WEIGHT + BOB_WEIGHT);
        assertEq(againstVotes, CAROL_WEIGHT);
    }

    // =========================================================================
    // 18. finalize — happy path Defeated (Against majority)
    // =========================================================================

    function test_finalize_HappyPath_Defeated() public {
        // We don't use the default proposal here; create one with flipped weights
        // so that Against > For without relying on specific weights of the default fixture.
        // carol (15) + bob (25) vote Against → 40 Against
        // alice (60) votes For               → 60 For
        // Re-use default holders but flip: bob+carol Against, alice For
        // Adjust weights: we need Against > For.
        // Use alice=15, bob=25, carol=60 scenario via a fresh proposal.
        address[] memory holders = new address[](3);
        holders[0] = alice;
        holders[1] = bob;
        holders[2] = carol;

        uint256[] memory weights = new uint256[](3);
        weights[0] = 15e18; // alice small
        weights[1] = 25e18; // bob medium
        weights[2] = 60e18; // carol large

        vm.prank(issuer);
        uint256 id2 = gov.propose(
            address(token),
            "Propuesta derrotada",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );

        // carol (60) + bob (25) Against → 85 Against; alice (15) For → 15 For
        vm.prank(alice);
        gov.castVote(id2, Governance.VoteOption.For);
        vm.prank(bob);
        gov.castVote(id2, Governance.VoteOption.Against);
        vm.prank(carol);
        gov.castVote(id2, Governance.VoteOption.Against);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        gov.finalize(id2);

        (, , , , , , , , , , Governance.ProposalStatus status2, ) = gov.proposals(id2);
        assertEq(uint256(status2), uint256(Governance.ProposalStatus.Defeated));
    }

    // =========================================================================
    // 19. finalize — happy path Tie (50 For / 50 Against)
    // =========================================================================

    function test_finalize_HappyPath_Tie() public {
        address[] memory holders = new address[](2);
        holders[0] = alice;
        holders[1] = bob;

        uint256[] memory weights = new uint256[](2);
        weights[0] = 50e18;
        weights[1] = 50e18;

        vm.prank(issuer);
        uint256 id = gov.propose(
            address(token),
            "Propuesta empatada",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );

        vm.prank(alice);
        gov.castVote(id, Governance.VoteOption.For);
        vm.prank(bob);
        gov.castVote(id, Governance.VoteOption.Against);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        vm.expectEmit(true, false, false, true);
        emit Governance.ProposalFinalized(id, Governance.ProposalStatus.Tie, 50e18, 50e18, 0);

        gov.finalize(id);

        (, , , , , , , , , , Governance.ProposalStatus status, ) = gov.proposals(id);
        assertEq(uint256(status), uint256(Governance.ProposalStatus.Tie));
    }

    // =========================================================================
    // 20. finalize — reverts if voting deadline has not yet passed
    // =========================================================================

    function test_finalize_RevertWhen_VotingPeriodActive() public {
        uint256 id = _proposeDefault();

        vm.expectRevert(abi.encodeWithSelector(Governance.VotingPeriodActive.selector, id));
        gov.finalize(id);
    }

    // =========================================================================
    // 21. finalize — reverts if proposal not found
    // =========================================================================

    function test_finalize_RevertWhen_ProposalNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(Governance.ProposalNotFound.selector, 42));
        gov.finalize(42);
    }

    // =========================================================================
    // 22. finalize — reverts on second call (AlreadyFinalized)
    // =========================================================================

    function test_finalize_RevertWhen_AlreadyFinalized() public {
        uint256 id = _proposeDefault();

        vm.prank(alice);
        gov.castVote(id, Governance.VoteOption.For);

        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        gov.finalize(id);

        // Second call must revert
        vm.expectRevert(abi.encodeWithSelector(Governance.AlreadyFinalized.selector, id));
        gov.finalize(id);
    }

    // =========================================================================
    // 23. getProposalStatus — returns Active while voting period is open
    // =========================================================================

    function test_getProposalStatus_Active_DuringVoting() public {
        uint256 id = _proposeDefault();

        // Should be Active while within deadline
        assertEq(uint256(gov.getProposalStatus(id)), uint256(Governance.ProposalStatus.Active));
    }

    // =========================================================================
    // 24. getProposalStatus — returns Passed after deadline but before finalize
    // =========================================================================

    function test_getProposalStatus_Passed_AfterDeadline_BeforeFinalize() public {
        uint256 id = _proposeDefault();

        // alice + bob vote For (85 total), carol Against (15)
        vm.prank(alice);
        gov.castVote(id, Governance.VoteOption.For);
        vm.prank(bob);
        gov.castVote(id, Governance.VoteOption.For);
        vm.prank(carol);
        gov.castVote(id, Governance.VoteOption.Against);

        // Advance past deadline but do NOT finalize
        vm.warp(block.timestamp + VOTING_PERIOD + 1);

        // View should already report Passed (pre-computed)
        assertEq(uint256(gov.getProposalStatus(id)), uint256(Governance.ProposalStatus.Passed));

        // Confirm finalized is still false (no state written)
        (, , , , , , , , , , , bool finalized) = gov.proposals(id);
        assertFalse(finalized);
    }

    // =========================================================================
    // 25. Multiple proposals are independent (votes don't cross)
    // =========================================================================

    function test_MultipleProposals_AreIndependent() public {
        (address[] memory holders, uint256[] memory weights) = _threeHolders();

        vm.startPrank(issuer);
        uint256 id0 = gov.propose(
            address(token),
            "Propuesta A",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD
        );
        uint256 id1 = gov.propose(
            address(token),
            "Propuesta B",
            holders,
            weights,
            block.timestamp + VOTING_PERIOD * 2
        );
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(gov.nextProposalId(), 2);

        // Vote on id0: alice For, bob Against
        vm.prank(alice);
        gov.castVote(id0, Governance.VoteOption.For);
        vm.prank(bob);
        gov.castVote(id0, Governance.VoteOption.Against);

        // Vote on id1: alice Against, carol For
        vm.prank(alice);
        gov.castVote(id1, Governance.VoteOption.Against);
        vm.prank(carol);
        gov.castVote(id1, Governance.VoteOption.For);

        // id0 tallies: 60 For, 25 Against
        (, , , , , , uint256 for0, uint256 against0, , , , ) = gov.proposals(id0);
        assertEq(for0, ALICE_WEIGHT);
        assertEq(against0, BOB_WEIGHT);

        // id1 tallies: 15 For (carol), 60 Against (alice)
        (, , , , , , uint256 for1, uint256 against1, , , , ) = gov.proposals(id1);
        assertEq(for1, CAROL_WEIGHT);
        assertEq(against1, ALICE_WEIGHT);

        // Votes on id0 do not affect id1 and vice-versa
        assertTrue(gov.hasVoted(id0, alice));
        assertTrue(gov.hasVoted(id1, alice));
        assertFalse(gov.hasVoted(id0, carol)); // carol didn't vote on id0
        assertFalse(gov.hasVoted(id1, bob)); // bob didn't vote on id1

        // Finalize id0 (advance past its deadline)
        vm.warp(block.timestamp + VOTING_PERIOD + 1);
        gov.finalize(id0);

        (, , , , , , , , , , Governance.ProposalStatus status0, ) = gov.proposals(id0);
        assertEq(uint256(status0), uint256(Governance.ProposalStatus.Passed)); // 60 > 25

        // id1 still active (longer deadline)
        assertEq(uint256(gov.getProposalStatus(id1)), uint256(Governance.ProposalStatus.Active));
    }
}
