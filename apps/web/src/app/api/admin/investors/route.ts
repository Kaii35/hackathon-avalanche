import { prisma, Prisma } from '@hack/database';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { jsonOk } from '@/lib/server/http/response';
import { sumsub } from '@/lib/server/services/sumsub.service';
import { chainVerifyAddress } from '@/lib/server/chain/identityRegistry';
import { auditService } from '@/lib/server/services/audit.service';
import { logger } from '@/lib/server/logger';

const JURISDICTION_LABELS: Record<number, string> = {
  484: 'México',
  840: 'Estados Unidos',
  724: 'España',
  124: 'Canadá',
  76: 'Brasil',
  152: 'Chile',
  32: 'Argentina',
};

function jurisdictionLabel(code: number | null | undefined): string {
  if (!code) return 'México';
  return JURISDICTION_LABELS[code] ?? `ISO ${code}`;
}

interface InvestorRow {
  id: string;
  fullName: string;
  email: string;
  wallet: string | null;
  kycStatus: 'pending' | 'verified' | 'rejected';
  jurisdiction: number;
  jurisdictionLabel: string;
  accredited: boolean;
  frozen: boolean;
  joinedAt: string;
  totalInvested: number;
}

/**
 * GET /api/admin/investors
 *
 * Returns every investor with the data the compliance admin needs:
 *   · personal info     (name, email)
 *   · primary wallet    (or null if not linked yet)
 *   · KYC status        (latest KycRecord wins over Identity row)
 *   · jurisdiction      (from Identity, fallback MX/484)
 *   · accredited flag   (from Identity)
 *   · frozen flag       (from Identity)
 *   · total invested    (sum of notional from settled trades where this user was buyer)
 */
// Tiny in-process cache so back-to-back admin page loads don't hammer Sumsub.
// First request reconciles; subsequent requests within the window skip the
// Sumsub round-trip and just read the DB.
let lastReconcileAt = 0;
const RECONCILE_INTERVAL_MS = 15_000;

async function reconcileOne(rec: { id: string; userId: string; externalId: string | null }) {
  try {
    const applicant = rec.externalId
      ? await sumsub.getApplicantByExternalId(rec.userId).catch(() => null)
      : null;
    const review = applicant?.review?.reviewResult?.reviewAnswer;
    const mapped: 'pending' | 'verified' | 'rejected' =
      review === 'GREEN' ? 'verified' : review === 'RED' ? 'rejected' : 'pending';
    if (mapped === 'pending') return;

    await prisma.kycRecord.update({
      where: { id: rec.id },
      data: { status: mapped, verifiedAt: mapped === 'verified' ? new Date() : null },
    });

    if (mapped === 'verified') {
      const user = await prisma.user.findUnique({
        where: { id: rec.userId },
        include: { wallets: { take: 1, where: { isPrimary: true } } },
      });
      const wallet = user?.wallets[0]?.address;
      if (wallet) {
        const onchain = await chainVerifyAddress(wallet as `0x${string}`);
        if (onchain.ok) {
          await prisma.identity.upsert({
            where: { wallet: wallet.toLowerCase() },
            create: {
              userId: rec.userId,
              wallet: wallet.toLowerCase(),
              kycStatus: 'verified',
              jurisdiction: 484,
              accredited: false,
              // Identity.claimHash is required by the schema. Until we wire a
              // real ClaimIssuer, derive a deterministic 32-byte hex from the
              // KycRecord id so the row passes schema validation and stays
              // queryable from the audit log.
              claimHash: '0x' + Buffer.from(rec.id).toString('hex').padEnd(64, '0').slice(0, 64),
              verifiedAt: new Date(),
            },
            update: { kycStatus: 'verified', verifiedAt: new Date() },
          });
          await auditService.record({
            action: 'identity.registered',
            actor: 'kyc-issuer',
            target: wallet,
            payload: { provider: 'sumsub', via: 'admin-reconcile' },
            txHash: onchain.alreadyVerified ? undefined : (onchain.txHash ?? undefined),
          });
        }
      }
    }

    await auditService.record({
      action: `kyc.${mapped}`,
      actor: 'admin-reconcile',
      target: applicant?.id ?? rec.id,
      payload: { provider: 'sumsub' },
    });
    logger.info({ userId: rec.userId, mapped }, 'kyc.sumsub.reconciled');
  } catch (e) {
    logger.warn({ userId: rec.userId, err: String(e) }, 'kyc.sumsub.reconcile.failed');
  }
}

/**
 * For every pending Sumsub KycRecord, hit Sumsub to grab the current verdict.
 * Defends against the case where the webhook never reached us (tunnel down,
 * missing config, etc.) — the admin page becomes self-healing.
 *
 * Runs in batches of 5 in parallel to keep latency low without flooding the
 * Sumsub sandbox. Throttled by RECONCILE_INTERVAL_MS to avoid duplicate work.
 */
async function reconcilePendingSumsubRecords(): Promise<void> {
  if (!sumsub.isConfigured()) return;
  const now = Date.now();
  if (now - lastReconcileAt < RECONCILE_INTERVAL_MS) return;
  lastReconcileAt = now;

  const pending = await prisma.kycRecord.findMany({
    where: { provider: 'sumsub', status: 'pending' },
    select: { id: true, userId: true, externalId: true },
    orderBy: { createdAt: 'desc' },
    take: 25, // cap per request
  });
  if (pending.length === 0) return;

  const BATCH = 5;
  for (let i = 0; i < pending.length; i += BATCH) {
    await Promise.allSettled(pending.slice(i, i + BATCH).map(reconcileOne));
  }
}

export const GET = withErrorHandler(
  withRole(['admin'], async () => {
    // Best-effort: pull fresh Sumsub statuses for any user whose record is
    // still 'pending' in our DB. If Sumsub is unreachable, the page just
    // shows the cached state.
    await reconcilePendingSumsubRecords();

    const users = await prisma.user.findMany({
      where: { role: 'investor' },
      include: {
        wallets: { where: { isPrimary: true }, take: 1 },
        identities: { take: 1, orderBy: { createdAt: 'desc' } },
        // Latest KYC record per user — this is the source of truth for the
        // verdict (Sumsub callback updates this). Identity.kycStatus lags
        // because it's only written after on-chain registerIdentity succeeds.
        kycRecords: { take: 1, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate total invested per wallet from settled trades.
    // Notional formula (matches Settlement.sol): payment = (qty * price) / 1e18.
    // Since payment is in USDC base units (6 decimals), divide by 1e6 for $ display.
    const wallets = users
      .map((u) => u.wallets[0]?.address?.toLowerCase())
      .filter((w): w is string => Boolean(w));

    const investedByWallet = new Map<string, number>();
    if (wallets.length > 0) {
      const trades = await prisma.trade.findMany({
        where: { buyOrder: { makerWallet: { in: wallets } } },
        select: {
          qty: true,
          price: true,
          buyOrder: { select: { makerWallet: true } },
        },
      });
      const SCALE = new Prisma.Decimal(10).pow(24); // 1e18 (token) * 1e6 (USDC)
      for (const t of trades) {
        const buyer = t.buyOrder.makerWallet.toLowerCase();
        const notional = t.qty.mul(t.price).div(SCALE).toNumber();
        investedByWallet.set(buyer, (investedByWallet.get(buyer) ?? 0) + notional);
      }
    }

    const investors: InvestorRow[] = users.map((u) => {
      const wallet = u.wallets[0]?.address ?? null;
      const identity = u.identities[0];
      const kyc = u.kycRecords[0];

      // KYC priority: most recent KycRecord (Sumsub source of truth) →
      // Identity.kycStatus (on-chain mirror) → pending (no record).
      const kycStatus =
        (kyc?.status as InvestorRow['kycStatus']) ??
        (identity?.kycStatus as InvestorRow['kycStatus']) ??
        'pending';

      const jurisdiction = identity?.jurisdiction ?? 484;

      return {
        id: u.id,
        fullName:
          [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0] || u.email,
        email: u.email,
        wallet,
        kycStatus,
        jurisdiction,
        jurisdictionLabel: jurisdictionLabel(jurisdiction),
        accredited: identity?.accredited ?? false,
        frozen: identity?.frozen ?? false,
        joinedAt: u.createdAt.toISOString(),
        totalInvested: wallet ? (investedByWallet.get(wallet.toLowerCase()) ?? 0) : 0,
      };
    });

    return jsonOk(investors);
  }),
);
