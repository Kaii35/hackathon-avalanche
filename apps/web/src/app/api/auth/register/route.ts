import type { NextRequest } from 'next/server';
import { RegisterSchema } from '@hack/shared';
import { authService } from '@/lib/server/services/auth.service';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { jsonCreated, parseJson, setSessionCookie } from '@/lib/server/http/response';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await parseJson<unknown>(req);
  const dto = RegisterSchema.parse(body);
  const { token, user } = await authService.register(dto);
  return setSessionCookie(jsonCreated({ user }), token);
});
