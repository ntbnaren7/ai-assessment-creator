import { Queue } from "bullmq";
import { getRedisConnection } from "../config/index.js";

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
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return assessmentQueue;
}

/**
 * Adds an assessment generation job to the queue.
 */
export async function addGenerationJob(assignmentId: string): Promise<void> {
  const queue = getAssessmentQueue();
  await queue.add(
    "generate",
    { assignmentId },
    {
      jobId: `gen-${assignmentId}`,
    }
  );
  console.log(`📋 Job queued for assignment: ${assignmentId}`);
}
