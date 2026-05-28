import { Request, Response, NextFunction } from "express";
import { Assignment } from "../models/index.js";
import { extractTextFromFile } from "../services/index.js";
import { addGenerationJob } from "../jobs/index.js";
import { CreateAssignmentInput } from "../utils/validation.js";

/**
 * POST /api/assignments
 * Creates a new assignment, extracts file content if uploaded, queues generation.
 */
export async function createAssignment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as CreateAssignmentInput;

    // Extract text from uploaded file (if present)
    let fileContent: string | null = null;
    if (req.file) {
      fileContent = await extractTextFromFile(req.file.buffer, req.file.mimetype);
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
