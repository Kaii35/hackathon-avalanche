import { prisma } from '@hack/database';
import { RATE_LIMITS } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { enforceRateLimit } from '@/lib/server/middleware/withRateLimit';
import { jsonOk } from '@/lib/server/http/response';
import { sumsub } from '@/lib/server/services/sumsub.service';
import { auditService } from '@/lib/server/services/audit.service';
import { logger } from '@/lib/server/logger';

/**
 * POST /api/kyc/sumsub/token
 * Returns a one-shot WebSDK access token for the authenticated user.
 * Idempotent — repeated calls reuse the same Sumsub applicant (keyed by userId).
 */
export const POST = withErrorHandler(
  withAuth(async (req, ctx) => {
    await enforceRateLimit(req, {
      bucket: 'kycStart',
      points: RATE_LIMITS.kycStart.points,
      durationSec: RATE_LIMITS.kycStart.durationSec,
      keyFromReq: () => ctx.user.sub,
    });

    if (!sumsub.isConfigured()) {
      throw new Error('Sumsub no configurado. Define SUMSUB_APP_TOKEN y SUMSUB_SECRET_KEY.');
    }

    const userId = ctx.user.sub;

    // 1) Make sure Sumsub knows about this user
    const applicant = await sumsub.ensureApplicant(userId);

    // 2) Persist a KycRecord row (or update if it already existed for this provider+externalId)
    await prisma.kycRecord.upsert({
      where: {
        provider_externalId: { provider: 'sumsub', externalId: applicant.id },
      },
      create: {
        userId,
        provider: 'sumsub',
        externalId: applicant.id,
        status: 'pending',
        payload: { levelName: sumsub.levelName, externalUserId: userId },
      },
      update: { status: 'pending' },
    });

    // 3) Issue a short-lived WebSDK token
    const { token } = await sumsub.generateAccessToken(userId);

    await auditService.record({
      action: 'kyc.sumsub.token.issued',
      actor: userId,
      target: applicant.id,
      payload: { levelName: sumsub.levelName },
    });

    logger.info({ userId, applicantId: applicant.id }, 'kyc.sumsub.token.issued');

    return jsonOk({
      token,
      applicantId: applicant.id,
      externalUserId: userId,
      levelName: sumsub.levelName,
    });
  }),
);
