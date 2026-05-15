import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', await deployer.getAddress());

  const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();
  console.log('IdentityRegistry:', await identity.getAddress());

  const Compliance = await ethers.getContractFactory('ComplianceRegistry');
  const compliance = await Compliance.deploy();
  await compliance.waitForDeployment();
  console.log('ComplianceRegistry:', await compliance.getAddress());

  const Factory = await ethers.getContractFactory('TokenFactory');
  const factory = await Factory.deploy(await identity.getAddress(), await compliance.getAddress());
  await factory.waitForDeployment();
  console.log('TokenFactory:', await factory.getAddress());

  const USDC = await ethers.getContractFactory('MockUSDC');
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();
  console.log('MockUSDC:', await usdc.getAddress());

  const Settlement = await ethers.getContractFactory('Settlement');
  const settlement = await Settlement.deploy(await deployer.getAddress(), 50); // 0.5%
  await settlement.waitForDeployment();
  console.log('Settlement:', await settlement.getAddress());

  console.log('\nDeploy completo. Copia las direcciones a .env');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
