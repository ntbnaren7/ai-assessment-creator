import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";
import { Error as MongooseError } from "mongoose";

/**
 * Global error handler middleware.
 */
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Mongoose Validation Error
  if (err instanceof MongooseError.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input data",
        details,
      },
    });
    return;
  }

  // Mongoose Cast Error (e.g. invalid ObjectId)
  if (err instanceof MongooseError.CastError) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_ID",
        message: `Invalid ${err.path}: ${err.value}`,
      },
    });
    return;
  }

  // Default fallback
  logger.error("Unhandled express error", {
    error: err.message,
    stack: err.stack,
    path: _req.path,
    method: _req.method,
  });

  const statusCode = err.status || 500;
  
  res.status(statusCode).json({
    success: false,
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
      message: process.env.NODE_ENV === "production" && statusCode === 500
        ? "Internal server error"
        : err.message,
    },
  });
}

