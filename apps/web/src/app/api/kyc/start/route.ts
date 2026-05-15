import { KycStartSchema, RATE_LIMITS } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { enforceRateLimit } from '@/lib/server/middleware/withRateLimit';
import { kycService } from '@/lib/server/services/kyc.service';
import { jsonOk, parseJson } from '@/lib/server/http/response';

export const POST = withErrorHandler(
  withAuth(async (req, ctx) => {
    await enforceRateLimit(req, {
      bucket: 'kycStart',
      points: RATE_LIMITS.kycStart.points,
      durationSec: RATE_LIMITS.kycStart.durationSec,
      keyFromReq: () => ctx.user.sub,
    });
    const body = await parseJson<unknown>(req);
    const dto = KycStartSchema.parse(body);
    const result = await kycService.start(ctx.user.sub, dto);
    return jsonOk(result);
  }),
);
