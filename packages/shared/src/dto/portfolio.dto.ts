export interface PortfolioPositionDto {
  offeringId: string;
  offeringName: string;
  symbol: string;
  balance: string;
  pricePerUnit: string;
  marketValue: string;
  percentOfOffering: number;
}

export interface PortfolioResponseDto {
  wallet: `0x${string}`;
  positions: PortfolioPositionDto[];
  totalMarketValue: string;
  asOf: string;
}
