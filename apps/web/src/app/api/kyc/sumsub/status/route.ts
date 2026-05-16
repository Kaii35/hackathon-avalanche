import { prisma } from '@hack/database';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { jsonOk } from '@/lib/server/http/response';
import { sumsub } from '@/lib/server/services/sumsub.service';
import { chainVerifyAddress } from '@/lib/server/chain/identityRegistry';
import { auditService } from '@/lib/server/services/audit.service';
import { logger } from '@/lib/server/logger';

/**
 * GET /api/kyc/sumsub/status
 *
 * Polls Sumsub for the authenticated user's current applicant status, reconciles
 * the local KycRecord, and — if the review came back GREEN and the user already
 * linked a wallet — fires `IdentityRegistry.verifyAddress(wallet)` on Fuji.
 *
 * This is the fallback path for environments where the Sumsub webhook can't
 * reach us (localhost without a tunnel). Webhook + this endpoint converge to
 * the same final state.
 */
export const GET = withErrorHandler(
  withAuth(async (_req, ctx) => {
    const userId = ctx.user.sub;

    if (!sumsub.isConfigured()) {
      return jsonOk({ status: 'unconfigured' as const });
    }

    const applicant = await sumsub.getApplicantByExternalId(userId);
    if (!applicant) {
      return jsonOk({ status: 'not_started' as const });
    }

    const reviewAnswer = applicant.review?.reviewResult?.reviewAnswer;
    const reviewStatus = applicant.review?.reviewStatus ?? 'init';

    const mapped: 'pending' | 'verified' | 'rejected' =
      reviewAnswer === 'GREEN' ? 'verified' : reviewAnswer === 'RED' ? 'rejected' : 'pending';

    const record = await prisma.kycRecord.findUnique({
      where: { provider_externalId: { provider: 'sumsub', externalId: applicant.id } },
    });

    let identityRegistered: { txHash?: string | null; alreadyVerified?: boolean } | undefined;

    if (record && record.status !== mapped) {
      await prisma.kycRecord.update({
        where: { id: record.id },
        data: {
          status: mapped,
          verifiedAt: mapped === 'verified' ? new Date() : null,
        },
      });

      if (mapped === 'verified') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { wallets: { take: 1, where: { isPrimary: true } } },
        });
        const wallet = user?.wallets[0]?.address;

        if (wallet) {
          const result = await chainVerifyAddress(wallet as `0x${string}`);
          if (result.ok) {
            await prisma.identity.upsert({
              where: { wallet: wallet.toLowerCase() },
              create: {
                userId,
                wallet: wallet.toLowerCase(),
                kycStatus: 'verified',
                jurisdiction: 484,
                accredited: false,
                // Required by schema; derive deterministically from record.id
                // until a real ClaimIssuer is wired in.
                claimHash:
                  '0x' + Buffer.from(record.id).toString('hex').padEnd(64, '0').slice(0, 64),
                verifiedAt: new Date(),
              },
              update: { kycStatus: 'verified', verifiedAt: new Date() },
            });
            await auditService.record({
              action: 'identity.registered',
              actor: 'kyc-issuer',
              target: wallet,
              payload: { provider: 'sumsub', applicantId: applicant.id },
              txHash: result.alreadyVerified ? undefined : (result.txHash ?? undefined),
            });
            identityRegistered = {
              txHash: result.alreadyVerified ? null : result.txHash,
              alreadyVerified: result.alreadyVerified,
            };
          } else {
            logger.warn({ wallet, result }, 'kyc.sumsub.onchain.skipped');
          }
        }

        await auditService.record({
          action: 'kyc.verified',
          actor: 'kyc-provider',
          target: applicant.id,
          payload: { provider: 'sumsub' },
        });
      }
    }

    return jsonOk({
      status: mapped,
      reviewStatus,
      applicantId: applicant.id,
      identityRegistered,
    });
  }),
);
