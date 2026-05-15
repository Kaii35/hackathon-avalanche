import { z } from 'zod';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withRole } from '@/lib/server/middleware/withRole';
import { matchingService } from '@/lib/server/services/matching.service';
import { jsonOk, parseJson } from '@/lib/server/http/response';

const Schema = z.object({ offeringId: z.string().uuid() });

export const POST = withErrorHandler(
  withRole(['admin', 'issuer'], async (req) => {
    const body = await parseJson<unknown>(req);
    const { offeringId } = Schema.parse(body);
    const result = await matchingService.runForOffering(offeringId);
    return jsonOk(result);
  }),
);
