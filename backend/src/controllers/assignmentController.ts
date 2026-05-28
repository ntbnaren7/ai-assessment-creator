import { Request, Response, NextFunction } from "express";
import { Assignment } from "../models/index.js";
import { extractTextFromFile } from "../services/index.js";
import { addGenerationJob } from "../jobs/index.js";
import { CreateAssignmentInput } from "../utils/validation.js";
import { loadRun } from "../services/ai/generation/generation-run.js";
import { getRedisConnection } from "../config/index.js";
import fs from "fs/promises";

/**
 * POST /api/assignments
 * Creates a new assignment, extracts file content if uploaded, queues generation.
 */
export async function createAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  let uploadedFilePath: string | null = null;
  
  try {
    const body = req.body as CreateAssignmentInput;

    // Extract text from uploaded file (if present)
    let fileContent: string | null = null;
    if (req.file) {
      uploadedFilePath = req.file.path;
      fileContent = await extractTextFromFile(req.file.path, req.file.mimetype);
    }

    // Create the assignment document in MongoDB
    const assignment = await Assignment.create({
      title: body.title,
      subject: body.subject,
      grade: body.grade,
      dueDate: new Date(body.dueDate),
      questionTypes: body.questionTypes,
      numberOfQuestions: body.numberOfQuestions,
      totalMarks: body.totalMarks,
      duration: body.duration,
      additionalInstructions: body.additionalInstructions || "",
      questionTypeDetails: body.questionTypeDetails,
      fileContent,
      status: "pending",
    });

    // Queue the generation job
    await addGenerationJob(assignment._id.toString());

    res.status(201).json({
      success: true,
      message: "Assignment created. Generation has been queued.",
      data: {
        assignmentId: assignment._id,
        status: assignment.status,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (uploadedFilePath) {
      try {
        await fs.unlink(uploadedFilePath);
      } catch (cleanupError) {
        // Log error but do not fail the request if cleanup fails
        console.error(`Failed to cleanup temp file: ${uploadedFilePath}`, cleanupError);
      }
    }
  }
}

/**
 * GET /api/assignments/:id
 * Retrieves a single assignment by ID.
 */
export async function getAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id);

    if (!assignment) {
      res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
      return;
    }

    res.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/assignments
 * Lists all assignments (most recent first).
 */
export async function listAssignments(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const assignments = await Assignment.find()
      .select("-generatedPaper -fileContent")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/assignments/:id/regenerate
 * Re-queues the generation job for an existing assignment.
 */
export async function regenerateAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id);

    if (!assignment) {
      res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
      return;
    }

    // Reset status and clear previous results
    assignment.status = "pending";
    assignment.generatedPaper = null;
    assignment.errorMessage = null;
    await assignment.save();

    // Force clear any stuck locks or runs in Redis so the worker can start fresh
    const redis = getRedisConnection();
    await redis.del(`gen-lock:${id}`);
    await redis.del(`gen-run:${id}`);

    // Re-queue generation
    await addGenerationJob(assignment._id.toString());

    res.json({
      success: true,
      message: "Regeneration has been queued.",
      data: {
        assignmentId: assignment._id,
        status: "pending",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/assignments/:id/progress
 * Polls the current generation progress directly from Redis.
 */
export async function getAssignmentProgress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findById(id).select("status errorMessage");

    if (!assignment) {
      res.status(404).json({ success: false, message: "Assignment not found" });
      return;
    }

    if (assignment.status === "completed") {
      res.json({ success: true, data: { progress: 100, status: "completed" } });
      return;
    }

    if (assignment.status === "failed") {
      res.json({ success: true, data: { progress: 0, status: "failed", message: assignment.errorMessage } });
      return;
    }

    // Status is 'pending' or 'processing', check Redis run state
    const run = await loadRun(id as string);
    if (!run) {
      res.json({ success: true, data: { progress: 0, status: assignment.status } });
      return;
    }

    let progress = 0;
    
    if (run.totalChunks > 0) {
      progress = Math.round((run.completedChunkIds.length / run.totalChunks) * 100);
    }

    // Ensure it doesn't return 100 if we are still assembling
    if (progress >= 100 && run.status !== "completed") {
      progress = 99; // Cap at 99 until DB sets to completed
    }

    res.json({
      success: true,
      data: {
        progress,
        status: assignment.status,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/assignments/:id
 * Hard delete an assignment, cancelling active jobs and clearing Redis state.
 */
export async function deleteAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    
    // 1. Clear Redis distributed state
    const redis = getRedisConnection();
    await redis.del(`gen-lock:${id}`);
    await redis.del(`gen-run:${id}`);

    // 2. Terminate active/pending BullMQ background jobs
    // We already import getAssessmentQueue from ../jobs/queue.js at the top (used by regenerate)
    const { getAssessmentQueue } = await import("../jobs/queue.js");
    const queue = getAssessmentQueue();
    const job = await queue.getJob(`gen-${id}`);
    if (job) {
      await job.remove();
    }

    // 3. Delete from MongoDB
    const assignment = await Assignment.findByIdAndDelete(id);
    
    if (!assignment) {
      res.status(404).json({ success: false, message: "Assignment not found" });
      return;
    }

    res.json({
      success: true,
      message: "Assignment successfully deleted and background processes terminated",
    });
  } catch (error) {
    next(error);
  }
}
