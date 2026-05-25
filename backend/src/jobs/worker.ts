import { Worker, Job } from "bullmq";
import { getRedisConnection } from "../config/index.js";
import { Assignment } from "../models/index.js";
import { generateQuestionPaper } from "../services/index.js";
import { getIO } from "../websockets/socketServer.js";

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
      console.log(`🔄 Processing job for assignment: ${assignmentId}`);

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

      // 2. Call Gemini to generate the paper
      const generatedPaper = await generateQuestionPaper(assignment);

      // 3. Save the result
      assignment.generatedPaper = generatedPaper as typeof assignment.generatedPaper;
      assignment.status = "completed";
      assignment.errorMessage = null;
      await assignment.save();

      // 4. Notify client: completed
      io.to(assignmentId).emit("status-update", {
        assignmentId,
        status: "completed",
        message: "Question paper generated successfully!",
      });

      console.log(`✅ Job completed for assignment: ${assignmentId}`);
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
    console.error(`❌ Job failed for assignment ${assignmentId}:`, err.message);

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
    console.log(`📦 Job ${job.id} completed`);
  });

  console.log("🏭 Assessment generation worker started");
  return worker;
}
