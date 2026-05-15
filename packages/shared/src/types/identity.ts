export type KycStatus = 'pending' | 'verified' | 'rejected';

export interface InvestorIdentity {
  userId: string;
  wallet: `0x${string}`;
  kycStatus: KycStatus;
  jurisdiction: number; // ISO 3166-1 numeric
  accredited: boolean;
  claimHash: `0x${string}`;
  verifiedAt: number | null;
}

export const JURISDICTION_MX = 484;
