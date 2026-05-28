import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../config/index.js";
import { Assignment } from "../models/index.js";
import { generateQuestionPaper } from "../services/index.js";
import { getIO } from "../websockets/socketServer.js";
import { logger } from "../utils/logger.js";

const QUEUE_NAME = "assessment-generation";

interface GenerationJobData {
  assignmentId: string;
}

/**
 * Starts the BullMQ worker that processes assessment generation jobs.
 */
export function startWorker(): Worker {
  const worker = new Worker<GenerationJobData>(
    QUEUE_NAME,
    async (job: Job<GenerationJobData>) => {
      const { assignmentId } = job.data;
      const log = logger.child({ assignmentId, jobId: job.id });

      log.info("Processing generation job");

      // 1. Update status to processing
      const assignment = await Assignment.findByIdAndUpdate(
        assignmentId,
        { status: "processing" },
        { new: true }
      );

      if (!assignment) {
        throw new Error(`Assignment not found: ${assignmentId}`);
      }

      // Notify client: processing started
      const io = getIO();
      io.to(assignmentId).emit("status-update", {
        assignmentId,
        status: "processing",
        message: "AI is generating your question paper...",
      });

      // 2. Call AI Service to generate the paper
      const startTime = Date.now();
      
      const progressCallback = (message: string, completed: number, total: number) => {
        io.to(assignmentId).emit("status-update", {
          assignmentId,
          status: "processing",
          message,
          progress: Math.round((completed / total) * 100),
        });
      };

      const { paper: generatedPaper, metadata } = await generateQuestionPaper(
        assignment,
        job.id!,
        progressCallback
      );
      
      const durationMs = Date.now() - startTime;

      log.info("AI generation completed", {
        durationMs,
        sections: (generatedPaper as { sections?: unknown[] }).sections?.length,
      });

      // 3. Save the result with retry logic
      assignment.generatedPaper = generatedPaper as unknown as typeof assignment.generatedPaper;
      assignment.generationMetadata = metadata;
      assignment.status = "completed";
      assignment.errorMessage = null;
      
      let saveAttempts = 0;
      let lastSaveError: any;
      while (saveAttempts < 3) {
        try {
          await assignment.save();
          lastSaveError = null;
          break; // Success
        } catch (err) {
          saveAttempts++;
          lastSaveError = err;
          log.warn(`Failed to save assignment (attempt ${saveAttempts}/3)`, { error: (err as Error).message });
          if (saveAttempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * saveAttempts));
          }
        }
      }

      if (lastSaveError) {
        throw new Error(`Failed to save completed assignment after 3 attempts: ${lastSaveError.message}`);
      }

      // 4. Notify client: completed
      io.to(assignmentId).emit("status-update", {
        assignmentId,
        status: "completed",
        message: "Question paper generated successfully!",
      });

      log.info("Job completed successfully", { durationMs });
      return { success: true };
    },
    {
      connection: getRedisConnection(),
      concurrency: 3,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { assignmentId } = job.data;
    logger.error("Job failed", {
      assignmentId,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      error: err.message,
    });

    // Update DB status to failed
    await Assignment.findByIdAndUpdate(assignmentId, {
      status: "failed",
      errorMessage: err.message,
    });

    // Notify client: failed
    const io = getIO();
    io.to(assignmentId).emit("status-update", {
      assignmentId,
      status: "failed",
      message: `Generation failed: ${err.message}`,
    });
  });

  worker.on("completed", (job) => {
    logger.info("Job finalized", { jobId: job.id });
  });

  logger.info("Assessment generation worker started");
  return worker;
}
