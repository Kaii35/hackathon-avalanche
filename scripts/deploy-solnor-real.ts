// Convierte la oferta SOLNOR (que era seed mock) en una oferta REAL on-chain
// donde ajelandro.lopez es el issuer admin.
//
// Pasos:
// 1. TokenFactory.deployOffering con issuerAdmin = ajelandro
// 2. Parse OfferingDeployed event para obtener la nueva dirección del token
// 3. UPDATE offering en DB con la nueva tokenAddress
// 4. Desde ajelandro: transfer 5k SOLNOR a alice + 5k SOLNOR a diego
// 5. Desde alice y diego: approve(Settlement, max) para SOLNOR

import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEventLogs,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { prisma } from '@hack/database';

const RPC = process.env.AVALANCHE_RPC_URL!;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY! as Hex;
const FACTORY = process.env.NEXT_PUBLIC_TOKEN_FACTORY! as Address;
const SETTLEMENT = process.env.NEXT_PUBLIC_SETTLEMENT! as Address;

// SOLNOR existing offering in DB
const SOLNOR_DB_ID = '81504844-cfbb-41be-a723-d2c3d7273b01';

// New issuer (ajelandro.lopez)
const AJELANDRO = {
  address: '0x3a1d811afacacea8e205fcb3c8a70e628d096ff2' as Address,
  key: '0x2874aeeb61ee517793e5eac2a8d89219808f6211afecde729d875d0ca0e20cd6' as Hex,
};

const ALICE = {
  address: '0x08115fa8e747f1524c32ce1b26b71a8b64b408d9' as Address,
  key: '0xafc7d281086bb4c718cc91b4c1214915c06339d14bf1bc472398bb116c334e95' as Hex,
};
const DIEGO_BOB = {
  address: '0x1ea61078e0479dc83121144a284dd79f5483b6fd' as Address,
  key: '0xad113ad2c7c0070ccf7a496b2bf7274e18f23013d9be52c0448d8883b53157ae' as Hex,
};

const TOTAL_SUPPLY = 250_000n * 10n ** 18n;
const SHARES_TO_ALICE = 5_000n * 10n ** 18n;
const SHARES_TO_DIEGO = 5_000n * 10n ** 18n;
const MAX_UINT256 = 2n ** 256n - 1n;

const TOKEN_FACTORY_ABI = [
  {
    type: 'function',
    name: 'deployOffering',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'offeringId', type: 'bytes32' },
      { name: 'name_', type: 'string' },
      { name: 'symbol_', type: 'string' },
      { name: 'issuerAdmin', type: 'address' },
      { name: 'complianceAgent', type: 'address' },
      { name: 'initialSupply', type: 'uint256' },
      { name: 'initialRecipient', type: 'address' },
    ],
    outputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'event',
    name: 'OfferingDeployed',
    inputs: [
      { name: 'offeringId', type: 'bytes32', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'issuerAdmin', type: 'address', indexed: true },
      { name: 'complianceAgent', type: 'address', indexed: false },
      { name: 'name_', type: 'string', indexed: false },
      { name: 'symbol_', type: 'string', indexed: false },
      { name: 'initialSupply', type: 'uint256', indexed: false },
      { name: 'initialRecipient', type: 'address', indexed: false },
    ],
  },
] as const;

const ERC20_TRANSFER_APPROVE_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'a', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

async function main() {
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
  const deployer = privateKeyToAccount(DEPLOYER_KEY);
  const deployerWallet = createWalletClient({
    account: deployer,
    chain: avalancheFuji,
    transport: http(RPC),
  });

  // === 1. Deploy SOLNOR via TokenFactory ===
  console.log('=== 1. Deploy SOLNOR via TokenFactory ===');
  const offeringIdBytes32 = keccak256(toBytes(SOLNOR_DB_ID));

  const deployTx = await deployerWallet.writeContract({
    address: FACTORY,
    abi: TOKEN_FACTORY_ABI,
    functionName: 'deployOffering',
    args: [
      offeringIdBytes32,
      'EnergíaSolar Norte',
      'SOLNOR',
      AJELANDRO.address, // issuerAdmin
      AJELANDRO.address, // complianceAgent (mismo por simplicidad)
      TOTAL_SUPPLY,
      AJELANDRO.address, // initialRecipient — todo el supply va a ajelandro
    ],
  });
  console.log(`  TX deploy: ${deployTx}`);
  const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployTx });

  // Parse OfferingDeployed event para extraer la dirección del token
  const events = parseEventLogs({
    abi: TOKEN_FACTORY_ABI,
    logs: deployReceipt.logs,
    eventName: 'OfferingDeployed',
  });
  if (events.length === 0) throw new Error('No OfferingDeployed event found');
  const tokenAddress = events[0]!.args.token as Address;
  console.log(`  Token deployed at: ${tokenAddress}`);

  // === 2. Update DB con la nueva tokenAddress ===
  console.log('\n=== 2. Update DB SOLNOR.tokenAddress ===');
  await prisma.offering.update({
    where: { id: SOLNOR_DB_ID },
    data: { tokenAddress: tokenAddress.toLowerCase() },
  });
  console.log('  DB actualizada');

  // === 3. Desde ajelandro: transferir 5k a alice + 5k a diego ===
  console.log('\n=== 3. Distribuir SOLNOR a alice y diego ===');
  const ajelandroWallet = createWalletClient({
    account: privateKeyToAccount(AJELANDRO.key),
    chain: avalancheFuji,
    transport: http(RPC),
  });

  const txToAlice = await ajelandroWallet.writeContract({
    address: tokenAddress,
    abi: ERC20_TRANSFER_APPROVE_ABI,
    functionName: 'transfer',
    args: [ALICE.address, SHARES_TO_ALICE],
  });
  await publicClient.waitForTransactionReceipt({ hash: txToAlice });
  console.log(`  Alice recibió 5,000 SOLNOR · TX: ${txToAlice}`);

  const txToDiego = await ajelandroWallet.writeContract({
    address: tokenAddress,
    abi: ERC20_TRANSFER_APPROVE_ABI,
    functionName: 'transfer',
    args: [DIEGO_BOB.address, SHARES_TO_DIEGO],
  });
  await publicClient.waitForTransactionReceipt({ hash: txToDiego });
  console.log(`  Diego recibió 5,000 SOLNOR · TX: ${txToDiego}`);

  // === 4. Approve Settlement desde alice y diego para SOLNOR ===
  console.log('\n=== 4. Approve Settlement para SOLNOR (alice y diego) ===');
  const aliceWallet = createWalletClient({
    account: privateKeyToAccount(ALICE.key),
    chain: avalancheFuji,
    transport: http(RPC),
  });
  const aliceApproveTx = await aliceWallet.writeContract({
    address: tokenAddress,
    abi: ERC20_TRANSFER_APPROVE_ABI,
    functionName: 'approve',
    args: [SETTLEMENT, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash: aliceApproveTx });
  console.log(`  Alice approve SOLNOR → Settlement · TX: ${aliceApproveTx}`);

  const diegoWallet = createWalletClient({
    account: privateKeyToAccount(DIEGO_BOB.key),
    chain: avalancheFuji,
    transport: http(RPC),
  });
  const diegoApproveTx = await diegoWallet.writeContract({
    address: tokenAddress,
    abi: ERC20_TRANSFER_APPROVE_ABI,
    functionName: 'approve',
    args: [SETTLEMENT, MAX_UINT256],
  });
  await publicClient.waitForTransactionReceipt({ hash: diegoApproveTx });
  console.log(`  Diego approve SOLNOR → Settlement · TX: ${diegoApproveTx}`);

  // === 5. Verificación final ===
  console.log('\n=== Estado final ===');
  for (const holder of [
    { name: 'Ajelandro (issuer)', addr: AJELANDRO.address },
    { name: 'Alice (investor)', addr: ALICE.address },
    { name: 'Diego (investor)', addr: DIEGO_BOB.address },
  ]) {
    const bal = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_TRANSFER_APPROVE_ABI,
      functionName: 'balanceOf',
      args: [holder.addr],
    });
    console.log(`  ${holder.name}: ${(Number(bal) / 1e18).toLocaleString('en-US')} SOLNOR`);
  }

  console.log(`\nSOLNOR deployado en: ${tokenAddress}`);
  console.log(`Snowscan: https://testnet.snowscan.xyz/address/${tokenAddress}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
