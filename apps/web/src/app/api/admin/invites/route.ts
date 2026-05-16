import { CreateAdminInviteSchema } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { adminInviteService } from '@/lib/server/services/adminInvite.service';
import { jsonCreated, jsonOk, parseJson } from '@/lib/server/http/response';

export const GET = withErrorHandler(
  withRole(['admin'], async () => {
    const invites = await adminInviteService.list();
    return jsonOk(invites);
  }),
);

export const POST = withErrorHandler(
  withRole(['admin'], async (req, ctx) => {
    const body = await parseJson<unknown>(req);
    const dto = CreateAdminInviteSchema.parse(body);
    const invite = await adminInviteService.create(
      { id: ctx.user.sub, email: ctx.user.email },
      dto,
    );
    return jsonCreated(invite);
  }),
);
