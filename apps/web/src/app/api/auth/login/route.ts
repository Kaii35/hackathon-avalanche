import type { NextRequest } from 'next/server';
import { LoginSchema, RATE_LIMITS } from '@hack/shared';
import { authService } from '@/lib/server/services/auth.service';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { enforceRateLimit } from '@/lib/server/middleware/withRateLimit';
import { jsonOk, parseJson, setSessionCookie } from '@/lib/server/http/response';

export const POST = withErrorHandler(async (req: NextRequest) => {
  await enforceRateLimit(req, {
    bucket: 'login',
    points: RATE_LIMITS.login.points,
    durationSec: RATE_LIMITS.login.durationSec,
  });
  const body = await parseJson<unknown>(req);
  const dto = LoginSchema.parse(body);
  const { token, user } = await authService.login(dto);
  return setSessionCookie(jsonOk({ user }), token);
});
