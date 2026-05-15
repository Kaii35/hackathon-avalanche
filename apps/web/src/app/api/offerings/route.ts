import { CreateOfferingSchema, OfferingsQuerySchema } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { offeringService } from '@/lib/server/services/offering.service';
import { jsonCreated, jsonOk, parseJson } from '@/lib/server/http/response';

export const GET = withErrorHandler(async (req) => {
  const params = OfferingsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await offeringService.list(params);
  return jsonOk(result);
});

export const POST = withErrorHandler(
  withRole(['issuer', 'admin'], async (req, ctx) => {
    const body = await parseJson<unknown>(req);
    const dto = CreateOfferingSchema.parse(body);
    const offering = await offeringService.create(ctx.user.email, dto);
    return jsonCreated(offering);
  }),
);
