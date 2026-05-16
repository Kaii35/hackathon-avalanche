import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { adminInviteService } from '@/lib/server/services/adminInvite.service';
import { jsonOk } from '@/lib/server/http/response';

export const DELETE = withErrorHandler(
  withRole<{ id: string }>(['admin'], async (_req, ctx) => {
    const result = await adminInviteService.revoke(
      { id: ctx.user.sub, email: ctx.user.email },
      ctx.params.id,
    );
    return jsonOk(result);
  }),
);
