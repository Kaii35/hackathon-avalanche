// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Governance} from "../src/Governance.sol";

/// @notice Deploys Governance to the active chain. Stateless contract, no
///         constructor args. After deploy, append to .env as
///         NEXT_PUBLIC_GOVERNANCE.
contract DeployGovernanceScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        Governance gov = new Governance();
        vm.stopBroadcast();

        console.log("Governance deployed at:", address(gov));
    }
}
