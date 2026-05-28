import { Queue } from "bullmq";
import { getRedisConnection } from "../config/index.js";
import { logger } from "../utils/logger.js";

const QUEUE_NAME = "assessment-generation";

let assessmentQueue: Queue | null = null;

export function getAssessmentQueue(): Queue {
  if (!assessmentQueue) {
    assessmentQueue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        timeout: 120000, // 120 seconds hard timeout
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return assessmentQueue;
}

/**
 * Adds an assessment generation job to the queue.
 * Removes any existing job for the same assignment to prevent
 * BullMQ's jobId deduplication from silently rejecting regenerations.
 */
export async function addGenerationJob(assignmentId: string): Promise<void> {
  const queue = getAssessmentQueue();

  // Remove any stale completed/failed job with the same base ID
  const existingJob = await queue.getJob(`gen-${assignmentId}`);
  if (existingJob) {
    try {
      await existingJob.remove();
    } catch {
      // Job may be active or locked — safe to ignore, we'll use a versioned ID
    }
  }

  const jobId = `gen-${assignmentId}-${Date.now()}`;
  await queue.add(
    "generate",
    { assignmentId },
    {
      jobId,
    }
  );
  logger.info("Job queued for assignment", { assignmentId, jobId });
}
