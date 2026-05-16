import { createPublicClient, http, type Address } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { prisma } from '@hack/database';
import type { PortfolioResponseDto, PortfolioPositionDto } from '@hack/shared';

const RPC_URL = process.env.AVALANCHE_RPC_URL ?? 'https://api.avax-test.network/ext/bc/C/rpc';

const ERC20_BALANCE_OF = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

// SecurityTokens en este proyecto tienen 18 decimales por defecto.
const TOKEN_DECIMALS = 18n;

let _client: ReturnType<typeof createPublicClient> | null = null;
function chainClient() {
  if (!_client) {
    _client = createPublicClient({ chain: avalancheFuji, transport: http(RPC_URL) });
  }
  return _client;
}

/**
 * Portfolio leído ON-CHAIN. Para cada Offering con tokenAddress, hace
 * balanceOf(wallet). Skipea la dependencia del indexer (que aún no escucha
 * eventos reales de Fuji) — así cualquier trade nuevo se refleja al instante
 * sin necesidad de scripts de sincronización.
 *
 * Trade-off: cada llamada hace N lecturas RPC (1 por offering con token).
 * Para N pequeño es aceptable; para N grande conviene multicall agregado o
 * volver a leer de DB indexada cuando el indexer real esté wireado.
 */
export const portfolioService = {
  async getByWallet(wallet: string): Promise<PortfolioResponseDto> {
    const lower = wallet.toLowerCase() as `0x${string}`;

    // Solo ofertas con token desplegado — las demás no aplican on-chain.
    const offerings = await prisma.offering.findMany({
      where: { tokenAddress: { not: null } },
      select: {
        id: true,
        name: true,
        symbol: true,
        pricePerUnit: true,
        totalSupply: true,
        tokenAddress: true,
      },
    });

    if (offerings.length === 0) {
      return {
        wallet: lower,
        positions: [],
        totalMarketValue: '0.00',
        asOf: new Date().toISOString(),
      };
    }

    const client = chainClient();

    // Lectura paralela de balanceOf por cada token.
    const balances = await Promise.allSettled(
      offerings.map((o) =>
        client.readContract({
          address: o.tokenAddress as Address,
          abi: ERC20_BALANCE_OF,
          functionName: 'balanceOf',
          args: [lower],
        }),
      ),
    );

    const positions: PortfolioPositionDto[] = [];
    for (let i = 0; i < offerings.length; i++) {
      const offering = offerings[i]!;
      const result = balances[i]!;

      if (result.status !== 'fulfilled') continue;
      const raw = result.value;
      if (raw === 0n) continue;

      // Convert from 18-decimal base units to pretty units (lossy on extreme
      // precision but fine for UI display — we never use this for accounting).
      const divisor = 10n ** TOKEN_DECIMALS;
      const wholePart = raw / divisor;
      const fracPart = raw % divisor;
      const balanceNumber = Number(wholePart) + Number(fracPart) / Number(divisor);

      const price = Number(offering.pricePerUnit);
      const totalSupplyNum = Number(offering.totalSupply);
      const marketValue = balanceNumber * price;
      const pctOfOffering = totalSupplyNum > 0 ? (balanceNumber / totalSupplyNum) * 100 : 0;

      positions.push({
        offeringId: offering.id,
        offeringName: offering.name,
        symbol: offering.symbol,
        balance: balanceNumber.toString(),
        pricePerUnit: offering.pricePerUnit.toString(),
        marketValue: marketValue.toFixed(2),
        percentOfOffering: Number(pctOfOffering.toFixed(4)),
      });
    }

    const total = positions.reduce((acc, p) => acc + Number(p.marketValue), 0);
    return {
      wallet: lower,
      positions,
      totalMarketValue: total.toFixed(2),
      asOf: new Date().toISOString(),
    };
  },
};
