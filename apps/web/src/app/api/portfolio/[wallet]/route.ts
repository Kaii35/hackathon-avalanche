import { prisma } from '@hack/database';
import { ForbiddenError, ValidationError } from '@hack/shared';
import { withErrorHandler } from '@/lib/server/middleware/withErrorHandler';
import { withAuth } from '@/lib/server/middleware/withAuth';
import { portfolioService } from '@/lib/server/services/portfolio.service';
import { jsonOk } from '@/lib/server/http/response';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Portfolio is private financial data. Callers must be authenticated AND
 * own the wallet they query, OR be an admin. Without these checks anyone
 * with a wallet address could enumerate full holdings (CNBV violation).
 */
export const GET = withErrorHandler<{ params: Promise<{ wallet: string }> }>(
  withAuth<{ wallet: string }>(async (_req, ctx) => {
    const { wallet } = ctx.params;
    if (!ADDRESS_RE.test(wallet)) throw new ValidationError('Wallet inválida');

    const lower = wallet.toLowerCase();

    // Admin can read any wallet for support / oversight workflows.
    if (ctx.user.role !== 'admin') {
      const ownsWallet = await prisma.wallet.findFirst({
        where: { userId: ctx.user.sub, address: lower },
        select: { id: true },
      });
      if (!ownsWallet) {
        throw new ForbiddenError('Solo puedes consultar tu propio portafolio');
      }
    }

    const result = await portfolioService.getByWallet(lower);
    return jsonOk(result);
  }),
);
