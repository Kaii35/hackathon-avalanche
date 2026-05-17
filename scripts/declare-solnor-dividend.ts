// Declaración MANUAL de dividendo SOLNOR via viem.
// Bypasea la UI — útil cuando hay un problema con el bundle / wallet del
// browser y necesitamos un evento on-chain ya.
//
// Flujo:
//   1. Conecta como ajelandro (issuer admin de SOLNOR).
//   2. Lee cap table on-chain: balance de cada holder en SOLNOR.
//   3. Computa prorrata: total USDC × balance / sumBalances.
//   4. Approve USDC al DividendDistributor por el total.
//   5. declare(token, USDC, holders, amounts).
//   6. Imprime el dividendId resultante para que el UI lo refleje.
//
// Run: pnpm --filter @hack/database exec tsx ../../scripts/declare-solnor-dividend.ts

import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(__dirname, '..', '.env') });

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  parseEventLogs,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';

const RPC = process.env.AVALANCHE_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';
const USDC = '0x31E5aA694baebF0420170bD9b132F9b5c4b38A83' as Address;
const DIVIDEND_DISTRIBUTOR = '0x71dA4E2cbc181F7eE9936c7A8243566fDcAb93c6' as Address;
const SOLNOR_TOKEN = '0x791fC7021b2A8c8619F7daf980c26809Db90B6Dc' as Address;

const AJELANDRO = {
  address: '0x3a1d811afacacea8e205fcb3c8a70e628d096ff2' as Address,
  key: '0x2874aeeb61ee517793e5eac2a8d89219808f6211afecde729d875d0ca0e20cd6' as Hex,
};
const ALICE = '0x08115fa8e747f1524c32ce1b26b71a8b64b408d9' as Address;
const DIEGO = '0x1ea61078e0479dc83121144a284dd79f5483b6fd' as Address;

// USDC total a distribuir — match con lo que muestras en la UI.
const TOTAL_USDC = parseUnits('20', 6); // 20 USDC

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'mint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const DIVIDEND_ABI = [
  {
    name: 'declare',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'paymentToken', type: 'address' },
      { name: 'holders', type: 'address[]' },
      { name: 'amounts', type: 'uint256[]' },
    ],
    outputs: [{ name: 'dividendId', type: 'uint256' }],
  },
  {
    name: 'nextDividendId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'DividendDeclared',
    inputs: [
      { name: 'dividendId', type: 'uint256', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'paymentToken', type: 'address', indexed: true },
      { name: 'declaredBy', type: 'address', indexed: false },
      { name: 'totalAmount', type: 'uint256', indexed: false },
      { name: 'holderCount', type: 'uint256', indexed: false },
    ],
  },
] as const;

async function main() {
  const account = privateKeyToAccount(AJELANDRO.key);
  const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
  const walletClient = createWalletClient({
    chain: avalancheFuji,
    transport: http(RPC),
    account,
  });

  // -------------------------------------------------------------------------
  // 1) Cap table on-chain — balances reales de SOLNOR.
  // -------------------------------------------------------------------------
  console.log('Leyendo cap table on-chain de SOLNOR…');
  const candidates: Address[] = [AJELANDRO.address, ALICE, DIEGO];
  const balances = await Promise.all(
    candidates.map((h) =>
      publicClient.readContract({
        address: SOLNOR_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [h],
      }),
    ),
  );

  const holdersWithBal = candidates
    .map((h, i) => ({ holder: h, balance: balances[i]! }))
    .filter((x) => x.balance > 0n);

  console.log(`Holders con balance > 0: ${holdersWithBal.length}`);
  for (const { holder, balance } of holdersWithBal) {
    console.log(`  ${holder}  →  ${formatUnits(balance, 18)} SOLNOR`);
  }

  // -------------------------------------------------------------------------
  // 2) Prorrata — totalUSDC × balance / sumBalances, último absorbe remainder.
  // -------------------------------------------------------------------------
  const sumBalances = holdersWithBal.reduce((a, b) => a + b.balance, 0n);
  const allocs = holdersWithBal.map((x) => (TOTAL_USDC * x.balance) / sumBalances);
  const distributed = allocs.reduce((a, b) => a + b, 0n);
  const remainder = TOTAL_USDC - distributed;
  if (allocs.length > 0) allocs[allocs.length - 1]! += remainder;

  console.log('\nAsignación pro-rata (USDC):');
  for (let i = 0; i < holdersWithBal.length; i++) {
    console.log(`  ${holdersWithBal[i]!.holder}  →  ${formatUnits(allocs[i]!, 6)} USDC`);
  }
  console.log(`  Total: ${formatUnits(TOTAL_USDC, 6)} USDC\n`);

  // -------------------------------------------------------------------------
  // 3) USDC: verificar balance y allowance, approve si hace falta.
  // -------------------------------------------------------------------------
  const usdcBal = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log(`Balance USDC de ajelandro: ${formatUnits(usdcBal, 6)} USDC`);
  if (usdcBal < TOTAL_USDC) {
    // MockUSDC.mint() es público en testnet — minteamos lo justo + margen.
    const toMint = TOTAL_USDC - usdcBal + parseUnits('80', 6);
    console.log(`Mock USDC insuficiente — minting ${formatUnits(toMint, 6)} USDC a ajelandro…`);
    const mintTx = await walletClient.writeContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: 'mint',
      args: [account.address, toMint],
    });
    console.log(`  mint tx: ${mintTx}`);
    await publicClient.waitForTransactionReceipt({ hash: mintTx });
    const newBal = await publicClient.readContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log(`  balance USDC actualizado: ${formatUnits(newBal, 6)} USDC\n`);
  }

  const currentAllowance = await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, DIVIDEND_DISTRIBUTOR],
  });
  console.log(`Allowance actual: ${formatUnits(currentAllowance, 6)} USDC`);

  if (currentAllowance < TOTAL_USDC) {
    console.log('Approving USDC al DividendDistributor…');
    const approveTx = await walletClient.writeContract({
      address: USDC,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [DIVIDEND_DISTRIBUTOR, TOTAL_USDC],
    });
    console.log(`  approve tx: ${approveTx}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(`  approve confirmado (block ${approveReceipt.blockNumber})\n`);
  } else {
    console.log('Allowance suficiente, skipping approve.\n');
  }

  // -------------------------------------------------------------------------
  // 4) declare() — emite DividendDeclared y bloquea el USDC en el pool.
  // -------------------------------------------------------------------------
  console.log('Llamando DividendDistributor.declare(…)');
  const declareTx = await walletClient.writeContract({
    address: DIVIDEND_DISTRIBUTOR,
    abi: DIVIDEND_ABI,
    functionName: 'declare',
    args: [SOLNOR_TOKEN, USDC, holdersWithBal.map((x) => x.holder), allocs],
  });
  console.log(`  declare tx: ${declareTx}`);
  const declareReceipt = await publicClient.waitForTransactionReceipt({ hash: declareTx });
  console.log(`  confirmado (block ${declareReceipt.blockNumber})\n`);

  // Parse DividendDeclared para extraer el id asignado.
  const events = parseEventLogs({
    abi: DIVIDEND_ABI,
    eventName: 'DividendDeclared',
    logs: declareReceipt.logs,
  });
  if (events.length === 0) {
    console.error('[warn] No se parseó DividendDeclared event, pero la tx confirmó.');
  } else {
    const ev = events[0]!;
    console.log(`✓ Dividendo declarado:`);
    console.log(`    dividendId  : ${ev.args.dividendId}`);
    console.log(`    token       : ${ev.args.token}`);
    console.log(`    totalAmount : ${formatUnits(ev.args.totalAmount, 6)} USDC`);
    console.log(`    holderCount : ${ev.args.holderCount}`);
    console.log(`    snowscan    : https://testnet.snowscan.xyz/tx/${declareTx}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
