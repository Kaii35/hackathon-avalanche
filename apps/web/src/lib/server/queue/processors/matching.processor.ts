import type { Processor } from 'bullmq';
import { matchingService } from '../../services/matching.service';
import { logger } from '../../logger';

export interface MatchingJob {
  offeringId: string;
}

export const matchingProcessor: Processor<MatchingJob> = async (job) => {
  const result = await matchingService.runForOffering(job.data.offeringId);
  logger.info({ offeringId: job.data.offeringId, matched: result.matched }, 'matching.run');
  return result;
};
