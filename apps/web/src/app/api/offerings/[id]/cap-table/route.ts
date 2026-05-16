import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { offeringService } from '@/lib/server/services/offering.service';
import { jsonOk } from '@/lib/server/http/response';

/**
 * Cap tables are private under CNBV — holder identities and balances per
 * offering must not be public. Gated to issuer + admin roles. A finer-
 * grained check (issuer must own the offering) is post-hackathon work
 * once the User↔Issuer link is modeled in the schema.
 */
export const GET = withErrorHandler<{ params: Promise<{ id: string }> }>(
  withRole<{ id: string }>(['issuer', 'admin'], async (_req, ctx) => {
    const { id } = ctx.params;
    const rows = await offeringService.capTable(id);
    return jsonOk({ offeringId: id, rows });
  }),
);
