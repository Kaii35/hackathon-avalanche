import { Prisma, prisma } from '@hack/database';
import {
  ComplianceError,
  NotFoundError,
  type ComplianceCheckQueryDto,
  type ComplianceCheckResponseDto,
  type ForcedTransferDto,
  type FreezeDto,
  type UnfreezeDto,
  type WhitelistDto,
} from '@hack/shared';
import { chainClient } from '../chain/client';
import { auditService } from './audit.service';
import { offeringRepo } from '../repositories/offering.repo';

export const adminService = {
  async freeze(actor: string, dto: FreezeDto) {
    await auditService.record({
      action: 'wallet.freeze.requested',
      actor,
      target: dto.wallet,
      payload: { reason: dto.reason },
    });
    const tx = await chainClient.token.freeze(dto.wallet, dto.reason);
    await prisma.identity.updateMany({ where: { wallet: dto.wallet }, data: { frozen: true } });
    await auditService.record({
      action: 'wallet.frozen',
      actor,
      target: dto.wallet,
      payload: { reason: dto.reason },
      txHash: tx.txHash,
    });
    return { txHash: tx.txHash };
  },

  async unfreeze(actor: string, dto: UnfreezeDto) {
    await auditService.record({
      action: 'wallet.unfreeze.requested',
      actor,
      target: dto.wallet,
      payload: { reason: dto.reason },
    });
    const tx = await chainClient.token.unfreeze(dto.wallet);
    await prisma.identity.updateMany({ where: { wallet: dto.wallet }, data: { frozen: false } });
    await auditService.record({
      action: 'wallet.unfrozen',
      actor,
      target: dto.wallet,
      payload: { reason: dto.reason },
      txHash: tx.txHash,
    });
    return { txHash: tx.txHash };
  },

  async whitelist(actor: string, dto: WhitelistDto) {
    await auditService.record({
      action: `whitelist.${dto.action}.requested`,
      actor,
      target: dto.wallet,
      payload: { jurisdiction: dto.jurisdiction, accredited: dto.accredited },
    });

    if (dto.action === 'add') {
      const claimHash = ('0x' +
        Buffer.from(`${dto.wallet}:${actor}`)
          .toString('hex')
          .padEnd(64, '0')
          .slice(0, 64)) as `0x${string}`;
      const tx = await chainClient.identity.registerIdentity({
        wallet: dto.wallet,
        jurisdiction: dto.jurisdiction,
        accredited: dto.accredited,
        claimHash,
      });
      await prisma.identity.upsert({
        where: { wallet: dto.wallet },
        create: {
          wallet: dto.wallet,
          jurisdiction: dto.jurisdiction,
          accredited: dto.accredited,
          claimHash,
          kycStatus: 'verified',
          verifiedAt: new Date(),
          user: {
            connectOrCreate: {
              where: { email: `${dto.wallet}@whitelist.local` },
              create: {
                email: `${dto.wallet}@whitelist.local`,
                passwordHash: '!',
                role: 'investor',
              },
            },
          },
        },
        update: {
          jurisdiction: dto.jurisdiction,
          accredited: dto.accredited,
          kycStatus: 'verified',
        },
      });
      await auditService.record({
        action: 'whitelist.added',
        actor,
        target: dto.wallet,
        payload: { jurisdiction: dto.jurisdiction, accredited: dto.accredited },
        txHash: tx.txHash,
      });
      return { txHash: tx.txHash };
    }

    const tx = await chainClient.identity.removeIdentity(dto.wallet);
    await prisma.identity.updateMany({
      where: { wallet: dto.wallet },
      data: { kycStatus: 'rejected' },
    });
    await auditService.record({
      action: 'whitelist.removed',
      actor,
      target: dto.wallet,
      payload: {},
      txHash: tx.txHash,
    });
    return { txHash: tx.txHash };
  },

  async forcedTransfer(actor: string, dto: ForcedTransferDto) {
    const offering = await offeringRepo.findById(dto.offeringId);
    if (!offering?.tokenAddress) throw new NotFoundError('Token de la oferta');
    await auditService.record({
      action: 'forced_transfer.requested',
      actor,
      target: dto.from,
      payload: { to: dto.to, qty: dto.qty, reason: dto.reason },
    });
    const tx = await chainClient.token.forcedTransfer({
      token: offering.tokenAddress as `0x${string}`,
      from: dto.from,
      to: dto.to,
      amount: BigInt(Math.floor(Number(dto.qty))),
      reason: dto.reason,
    });
    await auditService.record({
      action: 'forced_transfer.settled',
      actor,
      target: dto.from,
      payload: { to: dto.to, qty: dto.qty, reason: dto.reason },
      txHash: tx.txHash,
    });
    return { txHash: tx.txHash };
  },

  async complianceCheck(q: ComplianceCheckQueryDto): Promise<ComplianceCheckResponseDto> {
    const offering = await offeringRepo.findById(q.offeringId);
    if (!offering?.tokenAddress) throw new NotFoundError('Token de la oferta');
    const result = await chainClient.compliance.canTransfer({
      token: offering.tokenAddress as `0x${string}`,
      from: q.from,
      to: q.to,
      amount: BigInt(Math.floor(Number(q.amount))),
    });
    if (!result.allowed && result.reasons.length === 0) {
      throw new ComplianceError('Transferencia rechazada');
    }
    return {
      allowed: result.allowed,
      reasons: result.reasons,
      checkedAt: new Date().toISOString(),
    };
  },
};
