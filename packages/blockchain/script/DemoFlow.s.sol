// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {SecurityToken} from "../src/SecurityToken.sol";
import {Settlement} from "../src/Settlement.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @title  DemoFlowScript
 * @notice End-to-end demo flow against a live deployment of the platform.
 *         Run AFTER `Deploy.s.sol` has populated `.env` with the contract
 *         addresses on the target chain.
 *
 *         Steps (all on-chain, real transactions):
 *           1. Generate two ephemeral demo wallets (alice = seller,
 *              bob = buyer) and fund them with a sliver of AVAX for gas.
 *           2. KYC both wallets via {IdentityRegistry}.
 *           3. Mint demo USDC to bob.
 *           4. Deploy a fresh SecurityToken via {TokenFactory}, with 100
 *              units minted to alice as primary supply.
 *           5. Alice approves Settlement on the token; bob approves
 *              Settlement on USDC.
 *           6. Alice signs an EIP-712 sell order; bob signs a buy order.
 *           7. Deployer (holds MATCHER_ROLE) calls
 *              {Settlement.executeMatch} — the actual secondary trade.
 *           8. Final balances are logged so the demo can be verified on
 *              Snowtrace.
 *
 *         Required env:
 *           DEPLOYER_PRIVATE_KEY
 *           NEXT_PUBLIC_IDENTITY_REGISTRY
 *           NEXT_PUBLIC_TOKEN_FACTORY
 *           NEXT_PUBLIC_SETTLEMENT
 *           NEXT_PUBLIC_USDC
 */
contract DemoFlowScript is Script {
    function run() external {
        // -------------------------------------------------------------------
        // Setup
        // -------------------------------------------------------------------
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        IdentityRegistry registry = IdentityRegistry(
            vm.envAddress("NEXT_PUBLIC_IDENTITY_REGISTRY")
        );
        TokenFactory factory = TokenFactory(vm.envAddress("NEXT_PUBLIC_TOKEN_FACTORY"));
        Settlement settlement = Settlement(vm.envAddress("NEXT_PUBLIC_SETTLEMENT"));
        MockUSDC usdc = MockUSDC(vm.envAddress("NEXT_PUBLIC_USDC"));

        // Deterministic demo wallets so the same addresses show up each run.
        uint256 aliceKey = uint256(keccak256("arkangeles-demo-alice-seller-v1"));
        uint256 bobKey = uint256(keccak256("arkangeles-demo-bob-buyer-v1"));
        address alice = vm.addr(aliceKey);
        address bob = vm.addr(bobKey);

        console.log("=== Demo actors ===");
        console.log("Deployer (admin/oracle/matcher):", deployer);
        console.log("Alice    (seller)               :", alice);
        console.log("Bob      (buyer)                :", bob);
        console.log("");

        // -------------------------------------------------------------------
        // Step 1+2+3: deployer funds + KYCs + mints USDC
        // -------------------------------------------------------------------
        vm.startBroadcast(deployerKey);

        if (alice.balance < 0.003 ether) {
            (bool ok1, ) = alice.call{value: 0.003 ether}("");
            require(ok1, "fund alice failed");
        }
        if (bob.balance < 0.003 ether) {
            (bool ok2, ) = bob.call{value: 0.003 ether}("");
            require(ok2, "fund bob failed");
        }
        if (!registry.isVerified(alice)) registry.verifyAddress(alice);
        if (!registry.isVerified(bob)) registry.verifyAddress(bob);

        usdc.mint(bob, 1_000 * 1e6); // 1000 USDC to bob

        // -------------------------------------------------------------------
        // Step 4: factory deploys a new offering, mints initial supply to alice
        // -------------------------------------------------------------------
        bytes32 offeringId = keccak256(abi.encodePacked("ARK-DEMO-", block.timestamp));
        address tokenAddr = factory.deployOffering(
            offeringId,
            "Arkangeles Demo Offering",
            "ARKDEMO",
            deployer, // issuer admin
            deployer, // compliance agent
            100 * 1e18, // initial supply
            alice // initial recipient
        );
        SecurityToken token = SecurityToken(tokenAddr);

        vm.stopBroadcast();

        console.log("=== Offering deployed ===");
        console.log("Offering ID:", vm.toString(offeringId));
        console.log("Token addr :", tokenAddr);
        console.log("Alice token balance (1e18):", token.balanceOf(alice));
        console.log("");

        // -------------------------------------------------------------------
        // Step 5: approvals
        // -------------------------------------------------------------------
        vm.startBroadcast(aliceKey);
        token.approve(address(settlement), type(uint256).max);
        vm.stopBroadcast();

        vm.startBroadcast(bobKey);
        usdc.approve(address(settlement), type(uint256).max);
        vm.stopBroadcast();

        // -------------------------------------------------------------------
        // Step 6: build + sign EIP-712 orders
        // -------------------------------------------------------------------
        Settlement.Order memory sell = Settlement.Order({
            maker: alice,
            token: tokenAddr,
            paymentToken: address(usdc),
            side: Settlement.Side.Sell,
            qty: 10 * 1e18, // 10 tokens
            price: 5 * 1e6, // 5 USDC per token
            expiresAt: block.timestamp + 1 hours,
            salt: 1
        });
        Settlement.Order memory buy = Settlement.Order({
            maker: bob,
            token: tokenAddr,
            paymentToken: address(usdc),
            side: Settlement.Side.Buy,
            qty: 10 * 1e18,
            price: 5 * 1e6,
            expiresAt: block.timestamp + 1 hours,
            salt: 2
        });

        bytes32 sellDigest = settlement.hashOrder(sell);
        bytes32 buyDigest = settlement.hashOrder(buy);
        (uint8 sv, bytes32 sr, bytes32 ss) = vm.sign(aliceKey, sellDigest);
        (uint8 bv, bytes32 br, bytes32 bs) = vm.sign(bobKey, buyDigest);
        bytes memory sellSig = abi.encodePacked(sr, ss, sv);
        bytes memory buySig = abi.encodePacked(br, bs, bv);

        console.log("=== Order digests (EIP-712) ===");
        console.log("Sell digest:", vm.toString(sellDigest));
        console.log("Buy  digest:", vm.toString(buyDigest));
        console.log("");

        // -------------------------------------------------------------------
        // Step 7: deployer (MATCHER_ROLE) settles the trade atomically
        // -------------------------------------------------------------------
        vm.startBroadcast(deployerKey);
        settlement.executeMatch(buy, buySig, sell, sellSig, 10 * 1e18);
        vm.stopBroadcast();

        // -------------------------------------------------------------------
        // Step 8: report
        // -------------------------------------------------------------------
        console.log("=== TRADE EXECUTED ===");
        console.log("Alice tokens (after sell, expected 90e18):", token.balanceOf(alice));
        console.log("Bob   tokens (after buy,  expected 10e18):", token.balanceOf(bob));
        console.log(
            "Alice USDC   (proceeds 50 - 0.25 fee = 49.75 USDC, in 6 decimals):",
            usdc.balanceOf(alice)
        );
        console.log("Bob   USDC   (after pay,  expected 950 USDC):", usdc.balanceOf(bob));
        console.log("Fee recipient USDC accumulated:", usdc.balanceOf(deployer));
    }
}
