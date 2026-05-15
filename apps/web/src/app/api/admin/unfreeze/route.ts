import { UnfreezeSchema } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { adminService } from '@/lib/server/services/admin.service';
import { jsonOk, parseJson } from '@/lib/server/http/response';

export const POST = withErrorHandler(
  withRole(['admin'], async (req, ctx) => {
    const body = await parseJson<unknown>(req);
    const dto = UnfreezeSchema.parse(body);
    const result = await adminService.unfreeze(ctx.user.email, dto);
    return jsonOk(result);
  }),
);
