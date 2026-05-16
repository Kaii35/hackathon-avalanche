import { UpdateOfferingSchema } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { offeringService } from '@/lib/server/services/offering.service';
import { jsonOk, parseJson } from '@/lib/server/http/response';

export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const offering = await offeringService.get(id);
  return jsonOk(offering);
});

export const PATCH = withErrorHandler<{ params: Promise<{ id: string }> }>(
  withRole<{ id: string }>(['issuer', 'admin'], async (req, ctx) => {
    const body = await parseJson<unknown>(req);
    const dto = UpdateOfferingSchema.parse(body);
    const offering = await offeringService.update(
      { sub: ctx.user.sub, email: ctx.user.email, role: ctx.user.role },
      ctx.params.id,
      dto,
    );
    return jsonOk(offering);
  }),
);
