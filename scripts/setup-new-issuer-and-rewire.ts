// Setup completo:
// 1. Fund nueva wallet de ajelandro con 0.01 AVAX desde deployer
// 2. KYC nueva wallet en IdentityRegistry
// 3. Rewire DB:
//    - Unlink juan.perez (wallet + identity con Bob)
//    - Link Bob → diego.morales (update wallet + identity)
//    - Link nueva wallet → ajelandro.lopez (create wallet + identity)
// 4. Reset password de diego.morales a Demo1234!

import bcrypt from 'bcryptjs';
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { prisma } from '@hack/database';

const RPC = process.env.AVALANCHE_RPC_URL!;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY! as Hex;
const IR = '0x8Ca947A8c9714548eCe376a879D6755048018A82' as Address;

const BOB_WALLET = '0x1ea61078e0479dc83121144a284dd79f5483b6fd';
const NEW_AJELANDRO_WALLET = '0x3a1d811afacacea8e205fcb3c8a70e628d096ff2';

const IR_ABI = [
  {
    type: 'function',
    name: 'isVerified',
    stateMutability: 'view',
    inputs: [{ name: 'u', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'verifyAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'u', type: 'address' }],
    outputs: [],
  },
] as const;

async function main() {
  // === Setup chain clients ===
  const deployerAccount = privateKeyToAccount(DEPLOYER_KEY);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
  const deployerWallet = createWalletClient({
    account: deployerAccount,
    chain: avalancheFuji,
    transport: http(RPC),
  });

  // === 1. Fund nueva wallet (0.01 AVAX) ===
  console.log('=== 1. Fund nueva wallet de ajelandro con 0.01 AVAX ===');
  const balanceBefore = await publicClient.getBalance({ address: NEW_AJELANDRO_WALLET as Address });
  if (balanceBefore < parseEther('0.005')) {
    const fundTx = await deployerWallet.sendTransaction({
      to: NEW_AJELANDRO_WALLET as Address,
      value: parseEther('0.01'),
    });
    await publicClient.waitForTransactionReceipt({ hash: fundTx });
    console.log(`  TX fund: ${fundTx}`);
  } else {
    console.log('  Ya tenía AVAX suficiente, skip.');
  }

  // === 2. KYC en IdentityRegistry ===
  console.log('\n=== 2. KYC ajelandro nueva wallet ===');
  const alreadyKyc = await publicClient.readContract({
    address: IR,
    abi: IR_ABI,
    functionName: 'isVerified',
    args: [NEW_AJELANDRO_WALLET as Address],
  });
  if (!alreadyKyc) {
    const kycTx = await deployerWallet.writeContract({
      address: IR,
      abi: IR_ABI,
      functionName: 'verifyAddress',
      args: [NEW_AJELANDRO_WALLET as Address],
    });
    await publicClient.waitForTransactionReceipt({ hash: kycTx });
    console.log(`  TX kyc: ${kycTx}`);
  } else {
    console.log('  Ya estaba KYC, skip.');
  }

  // === 3. DB rewiring ===
  console.log('\n=== 3. DB rewiring ===');

  // 3a. Get users
  const juan = await prisma.user.findUnique({ where: { email: 'juan.perez@example.mx' } });
  const diego = await prisma.user.findUnique({ where: { email: 'diego.morales@example.mx' } });
  const ajelandro = await prisma.user.findUnique({
    where: { email: 'ajelandro.lopez@example.com' },
  });

  if (!juan) throw new Error('juan.perez no existe');
  if (!diego) throw new Error('diego.morales no existe');
  if (!ajelandro) throw new Error('ajelandro.lopez no existe');

  // 3b. Unlink juan.perez (delete his wallet + identity rows that hold Bob's address)
  // Esto libera el UNIQUE constraint para que diego pueda tomar Bob's address.
  const juanWalletDel = await prisma.wallet.deleteMany({ where: { userId: juan.id } });
  const juanIdentDel = await prisma.identity.deleteMany({ where: { userId: juan.id } });
  console.log(
    `  juan.perez: ${juanWalletDel.count} wallet(s) y ${juanIdentDel.count} identity(s) eliminadas`,
  );

  // 3c. Link Bob → diego.morales: update sus wallet + identity rows existentes
  // (diego ya tenía una wallet random del seed, la sobreescribimos).
  const diegoWallet = await prisma.wallet.findFirst({
    where: { userId: diego.id, isPrimary: true },
  });
  if (diegoWallet) {
    await prisma.wallet.update({
      where: { id: diegoWallet.id },
      data: { address: BOB_WALLET },
    });
  } else {
    await prisma.wallet.create({
      data: { userId: diego.id, address: BOB_WALLET, isPrimary: true },
    });
  }
  const diegoIdent = await prisma.identity.findFirst({ where: { userId: diego.id } });
  if (diegoIdent) {
    await prisma.identity.update({
      where: { id: diegoIdent.id },
      data: { wallet: BOB_WALLET, kycStatus: 'verified' },
    });
  }
  console.log(`  diego.morales: linkeado a Bob ${BOB_WALLET}`);

  // 3d. Link nueva wallet → ajelandro.lopez
  const ajeWallet = await prisma.wallet.findFirst({
    where: { userId: ajelandro.id, isPrimary: true },
  });
  if (ajeWallet) {
    await prisma.wallet.update({
      where: { id: ajeWallet.id },
      data: { address: NEW_AJELANDRO_WALLET },
    });
  } else {
    await prisma.wallet.create({
      data: { userId: ajelandro.id, address: NEW_AJELANDRO_WALLET, isPrimary: true },
    });
  }
  const ajeIdent = await prisma.identity.findFirst({ where: { userId: ajelandro.id } });
  if (ajeIdent) {
    await prisma.identity.update({
      where: { id: ajeIdent.id },
      data: { wallet: NEW_AJELANDRO_WALLET, kycStatus: 'verified' },
    });
  } else {
    await prisma.identity.create({
      data: {
        userId: ajelandro.id,
        wallet: NEW_AJELANDRO_WALLET,
        kycStatus: 'verified',
        jurisdiction: 484, // MX
        accredited: true,
        claimHash: '0x' + '0'.repeat(64),
        verifiedAt: new Date(),
      },
    });
  }
  console.log(`  ajelandro.lopez: linkeado a nueva wallet ${NEW_AJELANDRO_WALLET}`);

  // === 4. Reset password de diego a Demo1234! ===
  console.log('\n=== 4. Reset password diego.morales ===');
  const hash = await bcrypt.hash('Demo1234!', 10);
  await prisma.user.update({
    where: { email: 'diego.morales@example.mx' },
    data: { passwordHash: hash },
  });
  console.log('  OK');

  console.log('\nListo. Logout/login en la UI para refrescar la session.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
