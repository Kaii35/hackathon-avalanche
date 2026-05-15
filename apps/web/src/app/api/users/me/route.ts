import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { authService } from '@/lib/server/services/auth.service';
import { jsonOk } from '@/lib/server/http/response';

export const GET = withErrorHandler(
  withAuth(async (_req, ctx) => {
    const user = await authService.session(ctx.user.sub);
    return jsonOk({ user });
  }),
);
