import { prisma } from '@hack/database';
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { sumsub } from '@/lib/server/services/sumsub.service';
import { chainVerifyAddress } from '@/lib/server/chain/identityRegistry';
import { auditService } from '@/lib/server/services/audit.service';
import { logger } from '@/lib/server/logger';

/**
 * POST /api/kyc/sumsub/webhook
 *
 * Receives Sumsub callbacks. Verifies HMAC over the raw request body, then
 * reconciles KycRecord + Identity for the affected applicant.
 *
 * Sumsub fires several event types; we only act on:
 *   - applicantReviewed         (final review verdict)
 *   - applicantPending          (waiting for review)
 *   - applicantOnHold           (manual review)
 *
 * To wire this in the Sumsub dashboard:
 *   Integrations → Webhooks → New webhook → URL = https://<host>/api/kyc/sumsub/webhook
 *   Copy the generated secret to SUMSUB_WEBHOOK_SECRET in .env.
 */
export const POST = withErrorHandler(async (req) => {
  const rawBody = await req.text();
  const digest = req.headers.get('x-payload-digest') ?? undefined;
  const alg = req.headers.get('x-payload-digest-alg') ?? undefined;

  if (!sumsub.verifyWebhook(rawBody, { digest, alg })) {
    logger.warn({ alg }, 'kyc.sumsub.webhook.badSignature');
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  type Payload = {
    type?: string;
    applicantId?: string;
    externalUserId?: string;
    reviewResult?: { reviewAnswer?: 'GREEN' | 'RED'; rejectLabels?: string[] };
    reviewStatus?: string;
  };
  const event = JSON.parse(rawBody) as Payload;

  const externalUserId = event.externalUserId;
  const applicantId = event.applicantId;
  if (!applicantId || !externalUserId) {
    return NextResponse.json({ ignored: true, reason: 'missing ids' });
  }

  // Map Sumsub verdict → our internal enum
  let mapped: 'pending' | 'verified' | 'rejected' | null = null;
  if (event.type === 'applicantReviewed') {
    mapped = event.reviewResult?.reviewAnswer === 'GREEN' ? 'verified' : 'rejected';
  } else if (
    event.type === 'applicantPending' ||
    event.type === 'applicantOnHold' ||
    event.type === 'applicantCreated'
  ) {
    mapped = 'pending';
  }

  if (!mapped) {
    return NextResponse.json({ ignored: true, type: event.type ?? 'unknown' });
  }

  const record = await prisma.kycRecord.findUnique({
    where: { provider_externalId: { provider: 'sumsub', externalId: applicantId } },
  });
  // It's possible the webhook fires before the user calls /token (rare but possible
  // if the webhook URL was set up after an out-of-band applicant creation). Upsert
  // so we don't lose the verdict.
  const upserted = record
    ? await prisma.kycRecord.update({
        where: { id: record.id },
        data: {
          status: mapped,
          verifiedAt: mapped === 'verified' ? new Date() : null,
        },
      })
    : await prisma.kycRecord.create({
        data: {
          userId: externalUserId,
          provider: 'sumsub',
          externalId: applicantId,
          status: mapped,
          payload: { sourceEvent: event.type ?? 'unknown' },
          verifiedAt: mapped === 'verified' ? new Date() : null,
        },
      });

  if (mapped === 'verified') {
    const user = await prisma.user.findUnique({
      where: { id: upserted.userId },
      include: { wallets: { take: 1, where: { isPrimary: true } } },
    });
    const wallet = user?.wallets[0]?.address;
    if (wallet) {
      const result = await chainVerifyAddress(wallet as `0x${string}`);
      if (result.ok) {
        await prisma.identity.upsert({
          where: { wallet: wallet.toLowerCase() },
          create: {
            userId: upserted.userId,
            wallet: wallet.toLowerCase(),
            kycStatus: 'verified',
            jurisdiction: 484,
            accredited: false,
            // Required by schema; deterministic 32-byte hex until a real
            // ClaimIssuer is wired in.
            claimHash: '0x' + Buffer.from(upserted.id).toString('hex').padEnd(64, '0').slice(0, 64),
            verifiedAt: new Date(),
          },
          update: { kycStatus: 'verified', verifiedAt: new Date() },
        });
        await auditService.record({
          action: 'identity.registered',
          actor: 'kyc-issuer',
          target: wallet,
          payload: { provider: 'sumsub', applicantId, via: 'webhook' },
          txHash: result.alreadyVerified ? undefined : (result.txHash ?? undefined),
        });
      } else {
        logger.warn({ wallet, result }, 'kyc.sumsub.webhook.onchain.skipped');
      }
    }
  }

  await auditService.record({
    action: `kyc.${mapped}`,
    actor: 'kyc-provider',
    target: applicantId,
    payload: { provider: 'sumsub', via: 'webhook', type: event.type },
  });

  return NextResponse.json({ ok: true, mapped });
});
