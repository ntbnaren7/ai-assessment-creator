import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { config, validateConfig, connectDatabase, getRedisConnection } from "./config/index.js";
import { errorHandler } from "./middlewares/index.js";
import { initializeSocket } from "./websockets/index.js";
import { startWorker } from "./jobs/index.js";
import apiRoutes from "./routes/index.js";
import { logger } from "./utils/logger.js";

async function bootstrap(): Promise<void> {
  // 1. Validate environment config
  validateConfig();

  // 2. Connect to MongoDB
  await connectDatabase();

  // 3. Create Express app
  const app = express();
  app.set("trust proxy", 1); // Trust the reverse proxy (Render) to get real client IPs
  const httpServer = createServer(app);

  // 4. Security & parsing middleware
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // 5. Rate limiting
  const limiter = rateLimit({
    store: new RedisStore({
      sendCommand: async (...args: string[]) => (await getRedisConnection().call(args[0], ...args.slice(1))) as any,
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests, please try again later.",
    },
  });
  app.use("/api", limiter);

  // 6. API routes
  app.use("/api", apiRoutes);

  // 7. Global error handler
  app.use(errorHandler);

  // 8. Initialize WebSocket server
  initializeSocket(httpServer);

  // 9. Start BullMQ worker
  const worker = startWorker();

  // 10. Start listening
  httpServer.listen(config.port, () => {
    logger.info("Server started", {
      port: config.port,
      env: config.nodeEnv,
      url: `http://localhost:${config.port}`,
    });
  });

  // 11. Graceful Shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`);
    try {
      // Stop accepting new jobs and wait for active ones (up to 5s)
      if (worker) {
        logger.info("Closing BullMQ worker...");
        await worker.close();
      }
      
      logger.info("Closing HTTP server...");
      httpServer.close();

      logger.info("Closing MongoDB connection...");
      const mongoose = await import("mongoose");
      await mongoose.disconnect();

      logger.info("Shutdown complete.");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown", { error: err });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.error("Fatal error during startup", { error: err.message, stack: err.stack });
  process.exit(1);
});
