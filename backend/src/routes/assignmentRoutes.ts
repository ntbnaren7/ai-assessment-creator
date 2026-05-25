import { Router } from "express";
import {
  createAssignment,
  getAssignment,
  listAssignments,
  regenerateAssignment,
} from "../controllers/index.js";
import { validateBody, upload } from "../middlewares/index.js";
import { CreateAssignmentSchema } from "../utils/validation.js";

const router = Router();

// POST /api/assignments — Create a new assignment (with optional file upload)
router.post(
  "/",
  upload.single("file"),
  // Parse JSON fields from multipart form data
  (req, _res, next) => {
    if (typeof req.body.questionTypes === "string") {
      try {
        req.body.questionTypes = JSON.parse(req.body.questionTypes);
      } catch {
        // leave as-is, validation will catch it
      }
    }
    if (typeof req.body.numberOfQuestions === "string") {
      req.body.numberOfQuestions = parseInt(req.body.numberOfQuestions, 10);
    }
    if (typeof req.body.totalMarks === "string") {
      req.body.totalMarks = parseInt(req.body.totalMarks, 10);
    }
    next();
  },
  validateBody(CreateAssignmentSchema),
  createAssignment
);

// GET /api/assignments — List all assignments
router.get("/", listAssignments);

// GET /api/assignments/:id — Get a single assignment with generated paper
router.get("/:id", getAssignment);

// POST /api/assignments/:id/regenerate — Regenerate the question paper
router.post("/:id/regenerate", regenerateAssignment);

export default router;
