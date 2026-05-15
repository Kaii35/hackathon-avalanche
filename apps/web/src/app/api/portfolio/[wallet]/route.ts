import { ValidationError } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { portfolioService } from '@/lib/server/services/portfolio.service';
import { jsonOk } from '@/lib/server/http/response';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export const GET = withErrorHandler<{ params: Promise<{ wallet: string }> }>(async (_req, ctx) => {
  const { wallet } = await ctx.params;
  if (!ADDRESS_RE.test(wallet)) throw new ValidationError('Wallet inválida');
  const result = await portfolioService.getByWallet(wallet);
  return jsonOk(result);
});
