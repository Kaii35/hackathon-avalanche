import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { offeringService } from '@/lib/server/services/offering.service';
import { jsonOk } from '@/lib/server/http/response';

export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(async (_req, ctx) => {
  const { id } = await ctx.params;
  const offering = await offeringService.get(id);
  return jsonOk(offering);
});
