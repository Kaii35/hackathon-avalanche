// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DividendDistributor} from "../src/DividendDistributor.sol";

/// @notice Deploys DividendDistributor to the active chain. Stateless contract,
///         no constructor args. After deploy, append the address to .env as
///         NEXT_PUBLIC_DIVIDEND_DISTRIBUTOR.
contract DeployDividendScript is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        DividendDistributor distributor = new DividendDistributor();
        vm.stopBroadcast();

        console.log("DividendDistributor deployed at:", address(distributor));
    }
}
