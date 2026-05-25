import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { config } from "../config/index.js";

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
    console.log(`🔌 Client connected: ${socket.id}`);

    // Client joins a room scoped to their assignment ID for targeted updates
    socket.on("join-assignment", (assignmentId: string) => {
      if (typeof assignmentId === "string" && assignmentId.length > 0) {
        socket.join(assignmentId);
        console.log(`📎 Client ${socket.id} joined room: ${assignmentId}`);
      }
    });

    socket.on("leave-assignment", (assignmentId: string) => {
      if (typeof assignmentId === "string" && assignmentId.length > 0) {
        socket.leave(assignmentId);
        console.log(`📎 Client ${socket.id} left room: ${assignmentId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  console.log("🔌 WebSocket server initialized");
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
