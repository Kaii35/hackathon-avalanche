import { CreateOfferingSchema, OfferingsQuerySchema, AuthError } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { offeringService } from '@/lib/server/services/offering.service';
import { issuerService } from '@/lib/server/services/issuer.service';
import { getSession } from '@/lib/server/auth/session';
import { jsonCreated, jsonOk, parseJson } from '@/lib/server/http/response';

export const GET = withErrorHandler(async (req) => {
  const params = OfferingsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));

  // `mine=true` is the "Mis ofertas" filter — resolve the caller's Issuer
  // server-side and apply it as issuerId. Public listings (no `mine`) work
  // unauthenticated as before.
  if (params.mine) {
    const session = await getSession();
    if (!session) throw new AuthError('Sesión requerida', 'AUTH_REQUIRED');
    const issuer = await issuerService.ensureForUser(session.sub);
    params.issuerId = issuer.id;
  }

  const result = await offeringService.list(params);
  return jsonOk(result);
});

export const POST = withErrorHandler(
  withRole(['issuer', 'admin'], async (req, ctx) => {
    const body = await parseJson<unknown>(req);
    const dto = CreateOfferingSchema.parse(body);
    const offering = await offeringService.create(
      { sub: ctx.user.sub, email: ctx.user.email },
      dto,
    );
    return jsonCreated(offering);
  }),
);
