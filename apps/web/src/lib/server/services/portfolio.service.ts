import { prisma } from '@hack/database';
import type { PortfolioResponseDto, PortfolioPositionDto } from '@hack/shared';

export const portfolioService = {
  async getByWallet(wallet: string): Promise<PortfolioResponseDto> {
    const lower = wallet.toLowerCase();
    const entries = await prisma.capTableEntry.findMany({
      where: { wallet: lower },
      include: {
        offering: {
          select: { id: true, name: true, symbol: true, pricePerUnit: true, totalSupply: true },
        },
      },
    });

    const positions: PortfolioPositionDto[] = entries.map((e) => {
      const balance = Number(e.balance);
      const price = Number(e.offering.pricePerUnit);
      const total = Number(e.offering.totalSupply);
      const marketValue = balance * price;
      const pct = total > 0 ? (balance / total) * 100 : 0;
      return {
        offeringId: e.offering.id,
        offeringName: e.offering.name,
        symbol: e.offering.symbol,
        balance: e.balance.toString(),
        pricePerUnit: e.offering.pricePerUnit.toString(),
        marketValue: marketValue.toFixed(2),
        percentOfOffering: Number(pct.toFixed(4)),
      };
    });

    const total = positions.reduce((acc, p) => acc + Number(p.marketValue), 0);
    return {
      wallet: lower as `0x${string}`,
      positions,
      totalMarketValue: total.toFixed(2),
      asOf: new Date().toISOString(),
    };
  },
};
