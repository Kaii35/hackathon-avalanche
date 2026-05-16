import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { authService } from '@/lib/server/services/auth.service';
import { userService } from '@/lib/server/services/user.service';
import { jsonOk, parseJson } from '@/lib/server/http/response';
import { UpdateProfileSchema } from '@hack/shared';

export const GET = withErrorHandler(
  withAuth(async (_req, ctx) => {
    const user = await authService.session(ctx.user.sub);
    return jsonOk({ user });
  }),
);

export const PATCH = withErrorHandler(
  withAuth(async (req, ctx) => {
    const body = await parseJson<unknown>(req);
    const dto = UpdateProfileSchema.parse(body);
    const user = await userService.updateProfile(ctx.user.sub, dto);
    return jsonOk({ user });
  }),
);
