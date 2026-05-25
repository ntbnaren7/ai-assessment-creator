import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config, validateConfig, connectDatabase } from "./config/index.js";
import { errorHandler } from "./middlewares/index.js";
import { initializeSocket } from "./websockets/index.js";
import { startWorker } from "./jobs/index.js";
import apiRoutes from "./routes/index.js";

async function bootstrap(): Promise<void> {
  // 1. Validate environment config
  validateConfig();

  // 2. Connect to MongoDB
  await connectDatabase();

  // 3. Create Express app
  const app = express();
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
  startWorker();

  // 10. Start listening
  httpServer.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});
