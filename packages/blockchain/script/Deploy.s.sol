// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ComplianceManager} from "../src/ComplianceManager.sol";
import {TokenFactory} from "../src/TokenFactory.sol";
import {Settlement} from "../src/Settlement.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @title DeployScript
 * @notice Deploys the full on-chain core in the correct dependency order:
 *
 *           IdentityRegistry  ◄── KYC oracle authority
 *                 │
 *                 ▼
 *           ComplianceManager ◄── transfer rule engine
 *                 │
 *           ┌─────┴───────────────┐
 *           ▼                     ▼
 *      TokenFactory          Settlement     MockUSDC (testnet only)
 *      (deploys                 (atomic
 *       SecurityTokens)          token↔USDC swap)
 *
 *         By default every administrative role (oracle, admin, matcher, fee
 *         recipient) collapses to the deployer — convenient for testnet.
 *         In production each role should be a separate multisig; override
 *         via env vars.
 *
 * @dev    Run with:
 *
 *           forge script script/Deploy.s.sol \
 *             --rpc-url $AVALANCHE_RPC_URL \
 *             --broadcast \
 *             --verify -vvvv
 *
 *         Required env: DEPLOYER_PRIVATE_KEY.
 *         Optional env: ORACLE_ADDRESS, ADMIN_ADDRESS, MATCHER_ADDRESS,
 *                       FEE_RECIPIENT, FEE_BPS.
 */
contract DeployScript is Script {
    struct Deployment {
        IdentityRegistry registry;
        ComplianceManager compliance;
        TokenFactory factory;
        MockUSDC usdc;
        Settlement settlement;
    }

    function run() external returns (Deployment memory d) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Role separation. Defaults to deployer for testnet convenience.
        address oracle = vm.envOr("ORACLE_ADDRESS", deployer);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address matcher = vm.envOr("MATCHER_ADDRESS", deployer);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(50));

        console.log("=== Deployment plan ===");
        console.log("Chain id      :", block.chainid);
        console.log("Deployer      :", deployer);
        console.log("Oracle (KYC)  :", oracle);
        console.log("Admin         :", admin);
        console.log("Matcher       :", matcher);
        console.log("Fee recipient :", feeRecipient);
        console.log("Fee bps       :", feeBps);
        console.log("");

        vm.startBroadcast(deployerKey);

        d.registry = new IdentityRegistry(oracle);
        d.compliance = new ComplianceManager(admin, address(d.registry));
        d.factory = new TokenFactory(admin, address(d.compliance));
        d.usdc = new MockUSDC();
        d.settlement = new Settlement(admin, matcher, feeRecipient, feeBps);

        vm.stopBroadcast();

        console.log("=== Deployed addresses ===");
        console.log("IdentityRegistry :", address(d.registry));
        console.log("ComplianceManager:", address(d.compliance));
        console.log("TokenFactory     :", address(d.factory));
        console.log("MockUSDC         :", address(d.usdc));
        console.log("Settlement       :", address(d.settlement));
        console.log("");

        _writeDeploymentJson(d, deployer);
        _writeEnvSnippet(d);
    }

    // -------------------------------------------------------------------------
    // Outputs
    // -------------------------------------------------------------------------

    function _writeDeploymentJson(Deployment memory d, address deployer) private {
        string memory path = string.concat("./deployments/", vm.toString(block.chainid), ".json");
        string memory json = string.concat(
            "{\n",
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "deployer": "',
            vm.toString(deployer),
            '",\n',
            '  "deployedAt": ',
            vm.toString(block.timestamp),
            ",\n",
            '  "contracts": {\n',
            '    "IdentityRegistry": "',
            vm.toString(address(d.registry)),
            '",\n',
            '    "ComplianceManager": "',
            vm.toString(address(d.compliance)),
            '",\n',
            '    "TokenFactory": "',
            vm.toString(address(d.factory)),
            '",\n',
            '    "MockUSDC": "',
            vm.toString(address(d.usdc)),
            '",\n',
            '    "Settlement": "',
            vm.toString(address(d.settlement)),
            '"\n',
            "  }\n",
            "}\n"
        );
        vm.writeFile(path, json);
        console.log("Wrote deployment manifest to", path);
    }

    function _writeEnvSnippet(Deployment memory d) private {
        string memory snippet = string.concat(
            "# --- Auto-generated by Deploy.s.sol ---\n",
            "NEXT_PUBLIC_IDENTITY_REGISTRY=",
            vm.toString(address(d.registry)),
            "\n",
            "NEXT_PUBLIC_COMPLIANCE_REGISTRY=",
            vm.toString(address(d.compliance)),
            "\n",
            "NEXT_PUBLIC_TOKEN_FACTORY=",
            vm.toString(address(d.factory)),
            "\n",
            "NEXT_PUBLIC_USDC=",
            vm.toString(address(d.usdc)),
            "\n",
            "NEXT_PUBLIC_SETTLEMENT=",
            vm.toString(address(d.settlement)),
            "\n"
        );
        vm.writeFile("./deployments/latest.env", snippet);
        console.log("Wrote .env snippet to ./deployments/latest.env");
    }
}
