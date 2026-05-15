import { ComplianceCheckQuerySchema } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { adminService } from '@/lib/server/services/admin.service';
import { jsonOk } from '@/lib/server/http/response';

export const GET = withErrorHandler(async (req) => {
  const params = ComplianceCheckQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const result = await adminService.complianceCheck(params);
  return jsonOk(result);
});
