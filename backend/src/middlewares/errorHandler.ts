import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Global error handler middleware.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error("Unhandled express error", {
    error: err.message,
    stack: err.stack,
    path: _req.path,
    method: _req.method,
  });

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
}

