import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toHex,
  decodeEventLog,
  zeroAddress,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { logger } from '../logger';

/**
 * Direct viem caller for TokenFactory.deployOffering on Fuji.
 *
 * Bypasses the IfcMarketClient SDK on purpose: at this point CHAIN_MODE=avalanche
 * in .env but the SDK's avalanche adapter still throws. This module talks to the
 * deployed contract using the deployer wallet without going through that broken
 * adapter — same pattern as identityRegistry.ts.
 *
 * If credentials are missing the helper returns `{ skipped: true }` instead of
 * throwing — so an offering can still be persisted in our DB and we can wire the
 * on-chain piece later.
 */

const FACTORY_ABI = [
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
      { indexed: true, name: 'offeringId', type: 'bytes32' },
      { indexed: true, name: 'token', type: 'address' },
      { indexed: true, name: 'issuerAdmin', type: 'address' },
      { indexed: false, name: 'complianceAgent', type: 'address' },
      { indexed: false, name: 'name', type: 'string' },
      { indexed: false, name: 'symbol', type: 'string' },
      { indexed: false, name: 'initialSupply', type: 'uint256' },
      { indexed: false, name: 'initialRecipient', type: 'address' },
    ],
  },
] as const;

export type DeployOfferingResult =
  | {
      ok: true;
      tokenAddress: `0x${string}`;
      txHash: `0x${string}`;
      offeringIdBytes32: `0x${string}`;
    }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string };

function readConfig() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  const rpc = process.env.AVALANCHE_RPC_URL;
  const factory = process.env.NEXT_PUBLIC_TOKEN_FACTORY;
  const deployer = process.env.DEPLOYER_ADDRESS;
  return { pk, rpc, factory, deployer };
}

/**
 * Hash a backend UUID into the bytes32 `offeringId` the factory expects.
 * The hash is deterministic — same UUID always maps to the same bytes32.
 */
export function offeringIdToBytes32(uuid: string): `0x${string}` {
  return keccak256(toHex(uuid));
}

export async function chainDeployOffering(params: {
  /** Backend UUID — will be keccak256-hashed to bytes32 for the contract. */
  offeringUuid: string;
  name: string;
  symbol: string;
  /** Wei-denominated supply (token has 18 decimals → multiply your token count by 10n ** 18n). */
  initialSupplyWei: bigint;
  /** Address that receives the initial mint. Required iff initialSupplyWei > 0. */
  initialRecipient?: `0x${string}`;
  /** Becomes DEFAULT_ADMIN_ROLE on the SecurityToken. Defaults to deployer. */
  issuerAdmin?: `0x${string}`;
  /** Becomes AGENT_ROLE (freeze, forcedTransfer). Defaults to deployer. */
  complianceAgent?: `0x${string}`;
}): Promise<DeployOfferingResult> {
  const { pk, rpc, factory, deployer } = readConfig();
  if (!pk || !rpc || !factory) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing env (DEPLOYER_PRIVATE_KEY / AVALANCHE_RPC_URL / NEXT_PUBLIC_TOKEN_FACTORY)',
    };
  }

  try {
    const account = privateKeyToAccount(pk as Hex);
    const fallback = (deployer ?? account.address) as `0x${string}`;
    const publicClient = createPublicClient({ chain: avalancheFuji, transport: http(rpc) });
    const walletClient = createWalletClient({
      account,
      chain: avalancheFuji,
      transport: http(rpc),
    });

    const offeringIdBytes32 = offeringIdToBytes32(params.offeringUuid);
    const issuerAdmin = params.issuerAdmin ?? fallback;
    const complianceAgent = params.complianceAgent ?? fallback;
    // Factory mints only if initialSupply > 0. With supply=0 we can safely pass
    // zeroAddress as recipient (no KYC check required) — the issuer can later
    // call SecurityToken.mint(to, amount) themselves once they have DEFAULT_ADMIN_ROLE.
    const initialRecipient =
      params.initialSupplyWei > 0n
        ? (params.initialRecipient ?? fallback)
        : (zeroAddress as `0x${string}`);

    logger.info(
      {
        name: params.name,
        symbol: params.symbol,
        initialSupplyWei: params.initialSupplyWei.toString(),
        issuerAdmin,
        complianceAgent,
        initialRecipient,
      },
      'chain.tokenFactory.deploying',
    );

    const txHash = await walletClient.writeContract({
      address: factory as Hex,
      abi: FACTORY_ABI,
      functionName: 'deployOffering',
      args: [
        offeringIdBytes32,
        params.name,
        params.symbol,
        issuerAdmin,
        complianceAgent,
        params.initialSupplyWei,
        initialRecipient,
      ],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    // Find OfferingDeployed log from the factory contract to extract the
    // freshly deployed token address (returns from non-view fns aren't
    // available via writeContract — events are the canonical channel).
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== (factory as string).toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: FACTORY_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'OfferingDeployed') {
          const tokenAddress = decoded.args.token as `0x${string}`;
          logger.info({ tokenAddress, txHash, offeringIdBytes32 }, 'chain.tokenFactory.deployed');
          return { ok: true, tokenAddress, txHash, offeringIdBytes32 };
        }
      } catch {
        // Different event on the same address — skip.
      }
    }

    return {
      ok: false,
      skipped: false,
      error: 'OfferingDeployed event not found in tx receipt',
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    logger.error({ error }, 'chain.tokenFactory.deployFailed');
    return { ok: false, skipped: false, error };
  }
}
