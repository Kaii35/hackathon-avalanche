import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { clearSessionCookie, jsonOk } from '@/lib/server/http/response';

export const POST = withErrorHandler(async () => {
  return clearSessionCookie(jsonOk({ ok: true }));
});
