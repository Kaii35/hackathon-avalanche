import type { Processor } from 'bullmq';
import { prisma } from '@hack/database';
import type { NotificationType } from '@hack/shared';
import { logger } from '../../logger';

export interface NotificationJob {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
}

export const notificationProcessor: Processor<NotificationJob> = async (job) => {
  await prisma.notification.create({
    data: {
      userId: job.data.userId,
      type: job.data.type,
      title: job.data.title,
      body: job.data.body,
    },
  });
  logger.info({ userId: job.data.userId, type: job.data.type }, 'notification.delivered');
};
