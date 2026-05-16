import { createHash } from 'node:crypto';
import { prisma } from '@hack/database';
import { logger } from '../logger';

/**
 * Issuer onboarding helper.
 *
 * Right now an Issuer row needs to exist (Offering.issuerId is a required FK)
 * but we don't have an Issuer signup flow yet — a User with role='issuer' just
 * starts creating offerings. To bridge that gap, the first time an issuer-role
 * User creates an offering we auto-create an Issuer record keyed deterministically
 * by user.id. Re-running this is idempotent and always returns the same row.
 */

const DEPLOYER_FALLBACK = '0x66Cb45eE3646759179901567Fa81Fe2EBa639278';

/**
 * Deterministic Issuer.id derived from user.id so the same user always maps to
 * the same Issuer (idempotent across multiple offering creations).
 */
function deterministicIssuerId(userId: string): string {
  const hash = createHash('sha256').update(`issuer:${userId}`).digest('hex');
  // Format as UUID v4 shape (8-4-4-4-12) — Postgres UUID column accepts this.
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(
    16,
    20,
  )}-${hash.slice(20, 32)}`;
}

function deriveIssuerName(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  const local = user.email.split('@')[0] ?? user.email;
  return local;
}

export const issuerService = {
  /**
   * Get-or-create an Issuer record for the given user. Returns the Issuer row.
   *
   * Defaults:
   * - cnbvLicense: 'PENDING'   (issuer can update later when real license arrives)
   * - kycIssuerAddress: user's primary wallet if present, else deployer wallet
   *   (the deployer is currently the agent for every contract — see HANDOFF s4)
   */
  async ensureForUser(userId: string): Promise<{ id: string; name: string }> {
    const issuerId = deterministicIssuerId(userId);
    const existing = await prisma.issuer.findUnique({
      where: { id: issuerId },
      select: { id: true, name: true },
    });
    if (existing) return existing;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallets: { where: { isPrimary: true }, take: 1 } },
    });
    if (!user) {
      throw new Error(`Cannot create issuer for unknown user ${userId}`);
    }

    const kycIssuerAddress = (user.wallets[0]?.address ?? DEPLOYER_FALLBACK).toLowerCase();

    const created = await prisma.issuer.create({
      data: {
        id: issuerId,
        name: deriveIssuerName(user),
        cnbvLicense: 'PENDING',
        kycIssuerAddress,
      },
      select: { id: true, name: true },
    });

    logger.info({ userId, issuerId: created.id, name: created.name }, 'issuer.autoCreated');
    return created;
  },
};
