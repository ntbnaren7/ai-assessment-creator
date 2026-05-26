import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { isValidObjectId } from "mongoose";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { Assignment } from "../models/index.js";

let io: Server | null = null;

/**
 * Initializes the Socket.io server attached to the given HTTP server.
 */
export function initializeSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    logger.debug("Client connected", { socketId: socket.id });

    // Client joins a room scoped to their assignment ID for targeted updates
    socket.on("join-assignment", async (assignmentId: string) => {
      if (typeof assignmentId === "string" && assignmentId.length > 0) {
        // Guard: Prevent Mongoose CastError by validating ObjectId format first
        if (!isValidObjectId(assignmentId)) {
          logger.warn("Client attempted to join room with invalid ID format", { socketId: socket.id, assignmentId });
          socket.emit("error", { message: "Invalid assignment ID format" });
          return;
        }

        try {
          // Task 5: WebSocket auth — validate assignment exists before allowing room join
          const assignment = await Assignment.findById(assignmentId).select("_id").lean();
          if (!assignment) {
            logger.warn("Unauthorized room join attempt (assignment not found)", { socketId: socket.id, assignmentId });
            socket.emit("error", { message: "Assignment not found" });
            return;
          }

          socket.join(assignmentId);
          logger.info("Client joined room", { socketId: socket.id, assignmentId });
        } catch (error) {
           logger.error("Error validating assignment during room join", { socketId: socket.id, assignmentId, error });
        }
      }
    });

    socket.on("leave-assignment", (assignmentId: string) => {
      if (typeof assignmentId === "string" && assignmentId.length > 0) {
        socket.leave(assignmentId);
        logger.info("Client left room", { socketId: socket.id, assignmentId });
      }
    });

    socket.on("disconnect", () => {
      logger.debug("Client disconnected", { socketId: socket.id });
    });
  });

  logger.info("WebSocket server initialized");
  return io;
}

/**
 * Returns the Socket.io server instance.
 * Throws if called before initialization.
 */
export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io has not been initialized. Call initializeSocket first.");
  }
  return io;
}
