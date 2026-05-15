export interface Offering {
  id: string;
  issuerId: string;
  tokenAddress: `0x${string}`;
  name: string;
  symbol: string;
  prospectusIpfs: string;
  totalSupply: string;
  pricePerUnit: string;
  lockupUntil: number;
  maxHolders: number;
  allowedJurisdictions: number[];
  createdAt: number;
}

export interface CapTableEntry {
  wallet: `0x${string}`;
  balance: string;
  percentOfTotal: number;
  lastUpdatedBlock: number;
}
