"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAssignmentStore } from "@/store/useAssignmentStore";
import type { StatusUpdate } from "@/types";
import * as api from "@/services/api";
import type { Assignment } from "@/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:5001";

/**
 * Custom hook that manages WebSocket connection for real-time status updates.
 * Joins the assignment room and listens for status-update events.
 */
export function useWebSocket(assignmentId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const { setStatusUpdate, setCurrentAssignment, fetchAssignment } = useAssignmentStore();

  const connect = useCallback(() => {
    if (!assignmentId) return;

    // Prevent duplicate connections
    if (socketRef.current?.connected) {
      socketRef.current.emit("leave-assignment", assignmentId);
    }

    const socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("🔌 WebSocket connected");
      socket.emit("join-assignment", assignmentId);
    });

    socket.on("status-update", async (data: StatusUpdate) => {
      console.log("📡 Status update:", data);
      setStatusUpdate(data.status, data.message);

      // If completed, fetch the full assignment data with the generated paper
      if (data.status === "completed") {
        const result = (await api.getAssignment(assignmentId)) as {
          success: boolean;
          data: Assignment;
        };
        if (result.success) {
          setCurrentAssignment(result.data);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("🔌 WebSocket disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("WebSocket connection error:", err.message);
    });

    socketRef.current = socket;
  }, [assignmentId, setStatusUpdate, setCurrentAssignment, fetchAssignment]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        if (assignmentId) {
          socketRef.current.emit("leave-assignment", assignmentId);
        }
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect, assignmentId]);

  return socketRef.current;
}
