import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@hack/database';
import { ConflictError, ValidationError, type KycStartDto, type KycWebhookDto } from '@hack/shared';
import { auditService } from './audit.service';
import { chainClient } from '../chain/client';
import { logger } from '../logger';

const PROVIDER = 'mock';

function verifySignature(payload: KycWebhookDto): void {
  const secret = process.env.KYC_WEBHOOK_SECRET;
  if (!secret) throw new Error('KYC_WEBHOOK_SECRET no configurado');
  const expected = createHmac('sha256', secret)
    .update(`${payload.externalId}.${payload.status}`)
    .digest('hex');
  const provided = payload.signature.replace(/^0x/, '');
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'))
  ) {
    throw new ValidationError('Firma de webhook inválida');
  }
}

export const kycService = {
  async start(
    userId: string,
    dto: KycStartDto,
  ): Promise<{ status: 'pending'; externalId: string }> {
    const externalId = `mock-${userId}-${Date.now()}`;
    await prisma.kycRecord.create({
      data: {
        userId,
        provider: PROVIDER,
        externalId,
        status: 'pending',
        payload: {
          jurisdiction: dto.jurisdiction,
          accredited: dto.accredited,
          documentNumber: '[REDACTED]',
          fullName: '[REDACTED]',
          rfc: '[REDACTED]',
          curp: '[REDACTED]',
        },
      },
    });
    await auditService.record({
      action: 'kyc.started',
      actor: userId,
      target: externalId,
      payload: { jurisdiction: dto.jurisdiction, accredited: dto.accredited },
    });
    logger.info({ userId, externalId }, 'kyc.started');
    return { status: 'pending', externalId };
  },

  async handleWebhook(dto: KycWebhookDto): Promise<{ idempotent: boolean }> {
    verifySignature(dto);
    const existing = await prisma.kycRecord.findUnique({
      where: { provider_externalId: { provider: PROVIDER, externalId: dto.externalId } },
    });
    if (!existing) throw new ValidationError('externalId desconocido');
    if (existing.status === dto.status && existing.verifiedAt) {
      return { idempotent: true };
    }

    const verifiedAt = dto.status === 'verified' ? new Date() : null;
    await prisma.kycRecord.update({
      where: { id: existing.id },
      data: { status: dto.status, verifiedAt },
    });

    if (dto.status === 'verified') {
      const user = await prisma.user.findUnique({
        where: { id: existing.userId },
        include: { wallets: { take: 1, where: { isPrimary: true } } },
      });
      const wallet = user?.wallets[0]?.address;
      if (wallet) {
        const claimHash = ('0x' +
          Buffer.from(existing.id).toString('hex').padEnd(64, '0').slice(0, 64)) as `0x${string}`;
        const tx = await chainClient.identity.registerIdentity({
          wallet: wallet as `0x${string}`,
          jurisdiction: 484,
          accredited: false,
          claimHash,
        });
        await prisma.identity.upsert({
          where: { wallet: wallet.toLowerCase() },
          create: {
            userId: existing.userId,
            wallet: wallet.toLowerCase(),
            kycStatus: 'verified',
            jurisdiction: 484,
            accredited: false,
            claimHash,
            verifiedAt: new Date(),
          },
          update: { kycStatus: 'verified', verifiedAt: new Date(), claimHash },
        });
        await auditService.record({
          action: 'identity.registered',
          actor: 'kyc-issuer',
          target: wallet,
          payload: { externalId: dto.externalId },
          txHash: tx.txHash,
        });
      }
    }

    await auditService.record({
      action: `kyc.${dto.status}`,
      actor: 'kyc-provider',
      target: dto.externalId,
      payload: { provider: PROVIDER },
    });
    return { idempotent: false };
  },
};
