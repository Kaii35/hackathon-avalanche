/**
 * Fuji on-chain activity reader.
 * Backed by Routescan's Etherscan-compatible API for Avalanche Fuji (chainId 43113).
 * Public docs: https://routescan.io/documentation/api
 *
 * No API key required for read endpoints; throttled to ~5 req/s/IP.
 */

const ROUTESCAN_BASE = 'https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api';

export interface FujiTx {
  hash: `0x${string}`;
  type: 'native' | 'erc20';
  direction: 'in' | 'out' | 'self';
  from: `0x${string}`;
  to: `0x${string}`;
  value: string; // human-readable, formatted via decimals
  rawValue: string; // wei / smallest-unit string
  symbol: string;
  decimals: number;
  contractAddress?: `0x${string}`;
  timestamp: number; // ms
  blockNumber: number;
  isError: boolean;
}

interface RoutescanNativeTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError: string;
  txreceipt_status?: string;
  methodId?: string;
}

interface RoutescanTokenTx {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
}

interface RoutescanResp<T> {
  status: string;
  message: string;
  result: T[] | string;
}

function formatUnits(raw: string, decimals: number): string {
  if (!raw || raw === '0') return '0';
  try {
    const padded = raw.padStart(decimals + 1, '0');
    const intPart = padded.slice(0, padded.length - decimals) || '0';
    const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
    return fracPart ? `${intPart}.${fracPart}` : intPart;
  } catch {
    return raw;
  }
}

function direction(addr: string, from: string, to: string): FujiTx['direction'] {
  const a = addr.toLowerCase();
  const f = from.toLowerCase();
  const t = to.toLowerCase();
  if (f === a && t === a) return 'self';
  if (t === a) return 'in';
  return 'out';
}

async function callRoutescan<T>(params: Record<string, string | number>): Promise<T[]> {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) search.set(k, String(v));
  const url = `${ROUTESCAN_BASE}?${search.toString()}`;
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Routescan ${res.status}`);
  const json = (await res.json()) as RoutescanResp<T>;
  if (typeof json.result === 'string') {
    // "No transactions found" is a normal empty result
    if (/no\s+transactions\s+found/i.test(json.result)) return [];
    throw new Error(json.result);
  }
  return json.result ?? [];
}

export async function fetchNativeTxs(address: string, limit = 25): Promise<FujiTx[]> {
  const rows = await callRoutescan<RoutescanNativeTx>({
    module: 'account',
    action: 'txlist',
    address,
    startblock: 0,
    endblock: 99_999_999,
    page: 1,
    offset: limit,
    sort: 'desc',
  });
  return rows.map(
    (r): FujiTx => ({
      hash: r.hash as `0x${string}`,
      type: 'native',
      direction: direction(address, r.from, r.to),
      from: r.from as `0x${string}`,
      to: r.to as `0x${string}`,
      value: formatUnits(r.value, 18),
      rawValue: r.value,
      symbol: 'AVAX',
      decimals: 18,
      timestamp: Number(r.timeStamp) * 1000,
      blockNumber: Number(r.blockNumber),
      isError: r.isError === '1' || r.txreceipt_status === '0',
    }),
  );
}

export async function fetchTokenTxs(address: string, limit = 25): Promise<FujiTx[]> {
  const rows = await callRoutescan<RoutescanTokenTx>({
    module: 'account',
    action: 'tokentx',
    address,
    startblock: 0,
    endblock: 99_999_999,
    page: 1,
    offset: limit,
    sort: 'desc',
  });
  return rows.map((r): FujiTx => {
    const decimals = Number(r.tokenDecimal) || 18;
    return {
      hash: r.hash as `0x${string}`,
      type: 'erc20',
      direction: direction(address, r.from, r.to),
      from: r.from as `0x${string}`,
      to: r.to as `0x${string}`,
      value: formatUnits(r.value, decimals),
      rawValue: r.value,
      symbol: r.tokenSymbol || 'TOKEN',
      decimals,
      contractAddress: r.contractAddress as `0x${string}`,
      timestamp: Number(r.timeStamp) * 1000,
      blockNumber: Number(r.blockNumber),
      isError: false,
    };
  });
}

/**
 * Combined activity feed: native AVAX + ERC-20 transfers, deduped by hash,
 * sorted newest first.
 */
export async function fetchFujiActivity(address: string, limit = 25): Promise<FujiTx[]> {
  const [native, token] = await Promise.all([
    fetchNativeTxs(address, limit).catch(() => [] as FujiTx[]),
    fetchTokenTxs(address, limit).catch(() => [] as FujiTx[]),
  ]);
  // Token transfers ride on top of native txs; keep both rows since they carry
  // distinct semantics (a single hash can be one native + many erc20 lines).
  const combined = [...native, ...token];
  combined.sort((a, b) => b.timestamp - a.timestamp);
  return combined.slice(0, limit);
}
