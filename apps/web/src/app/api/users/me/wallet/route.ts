import { LinkWalletSchema } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { authService } from '@/lib/server/services/auth.service';
import { jsonOk, parseJson } from '@/lib/server/http/response';

export const POST = withErrorHandler(
  withAuth(async (req, ctx) => {
    const body = await parseJson<unknown>(req);
    const dto = LinkWalletSchema.parse(body);
    const result = await authService.linkWallet(ctx.user.sub, dto);
    return jsonOk(result);
  }),
);
