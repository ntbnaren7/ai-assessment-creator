import { Router } from "express";
import mongoose from "mongoose";
import assignmentRoutes from "./assignmentRoutes.js";
import { getRedisConnection } from "../config/index.js";

const router = Router();

router.use("/assignments", assignmentRoutes);

// Health check — verifies MongoDB and Redis connectivity
router.get("/health", async (_req, res) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // MongoDB
  try {
    const mongoState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    checks.mongodb = mongoState === 1 ? "ok" : `unhealthy (state: ${mongoState})`;
    if (mongoState !== 1) healthy = false;
  } catch {
    checks.mongodb = "unreachable";
    healthy = false;
  }

  // Redis
  try {
    const redis = getRedisConnection();
    const pong = await redis.ping();
    checks.redis = pong === "PONG" ? "ok" : "unhealthy";
    if (pong !== "PONG") healthy = false;
  } catch {
    checks.redis = "unreachable";
    healthy = false;
  }

  const statusCode = healthy ? 200 : 503;
  res.status(statusCode).json({
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    checks,
  });
});

export default router;

