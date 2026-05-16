import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { logger } from '../logger';

/**
 * Direct viem caller for IdentityRegistry on Fuji.
 *
 * Bypasses the IfcMarketClient SDK on purpose: at this point CHAIN_MODE=avalanche
 * in .env but the SDK's avalanche adapter still throws. This module talks to the
 * deployed contract using the deployer wallet (oracle) without going through
 * that broken adapter.
 *
 * If credentials are missing the helper returns `{ skipped: true }` instead of
 * throwing — so the KYC flow stays demoable even without on-chain setup.
 */

const IR_ABI = [
  {
    type: 'function',
    name: 'isVerified',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'verifyAddress',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
  },
] as const;

export type VerifyResult =
  | { ok: true; txHash: Hex; alreadyVerified: false }
  | { ok: true; txHash: null; alreadyVerified: true }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

function readConfig() {
  const pk = process.env.KYC_ISSUER_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  const rpc = process.env.AVALANCHE_RPC_URL;
  const registry = process.env.NEXT_PUBLIC_IDENTITY_REGISTRY;
  return { pk, rpc, registry };
}

export async function chainVerifyAddress(wallet: `0x${string}`): Promise<VerifyResult> {
  const { pk, rpc, registry } = readConfig();
  if (!pk || !rpc || !registry) {
    return {
      ok: false,
      skipped: true,
      reason: 'KYC_ISSUER_PRIVATE_KEY / AVALANCHE_RPC_URL / NEXT_PUBLIC_IDENTITY_REGISTRY missing',
    };
  }

  try {
    const account = privateKeyToAccount(pk as Hex);
    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpc) });

    // Idempotency: IdentityRegistry.verifyAddress reverts with AlreadyVerified
    // if the wallet is already registered. Short-circuit so re-running the
    // demo flow doesn't spam failed txs.
    const alreadyVerified = await publicClient.readContract({
      address: registry as Hex,
      abi: IR_ABI,
      functionName: 'isVerified',
      args: [wallet],
    });
    if (alreadyVerified) {
      logger.info({ wallet }, 'chain.identity.alreadyVerified');
      return { ok: true, txHash: null, alreadyVerified: true };
    }

    const walletClient = createWalletClient({
      account,
      chain: avalancheFuji,
      transport: http(rpc),
    });

    const txHash = await walletClient.writeContract({
      address: registry as Hex,
      abi: IR_ABI,
      functionName: 'verifyAddress',
      args: [wallet],
    });
    logger.info({ wallet, txHash }, 'chain.identity.verified');
    return { ok: true, txHash, alreadyVerified: false };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error({ wallet, error }, 'chain.identity.verifyFailed');
    return { ok: false, skipped: false, error };
  }
}

export async function chainIsVerified(wallet: `0x${string}`): Promise<boolean> {
  const { rpc, registry } = readConfig();
  if (!rpc || !registry) return false;
  try {
    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpc) });
    return (await publicClient.readContract({
      address: registry as Hex,
      abi: IR_ABI,
      functionName: 'isVerified',
      args: [wallet],
    })) as boolean;
  } catch {
    return false;
  }
}
