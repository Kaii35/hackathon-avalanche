import { KycWebhookSchema } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { kycService } from '@/lib/server/services/kyc.service';
import { jsonOk, parseJson } from '@/lib/server/http/response';

export const POST = withErrorHandler(async (req) => {
  const body = await parseJson<unknown>(req);
  const dto = KycWebhookSchema.parse(body);
  const result = await kycService.handleWebhook(dto);
  return jsonOk(result);
});
