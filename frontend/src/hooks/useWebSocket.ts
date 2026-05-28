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

    socket.on("connect", async () => {
      console.log("🔌 WebSocket connected");
      socket.emit("join-assignment", assignmentId);

      // Reconcile progress in case we missed events while disconnected
      try {
        const result = await api.getAssignmentProgress(assignmentId);
        if (result.success) {
          setStatusUpdate(
            result.data.status, 
            result.data.progress > 0 ? `Generating... ${result.data.progress}%` : undefined,
            result.data.progress
          );
          
          if (result.data.status === "completed") {
             const full = await api.getAssignment(assignmentId) as { success: boolean; data: Assignment };
             if (full.success) setCurrentAssignment(full.data);
          }
        }
      } catch (e) {
        console.warn("Failed to reconcile progress:", e);
      }
    });

    socket.on("status-update", async (data: StatusUpdate) => {
      console.log("📡 Status update:", data);

      // If completed, fetch the full assignment (with retry for DB replication lag)
      if (data.status === "completed") {
        setStatusUpdate("processing", "Finalizing document...", 100);
        let retries = 0;
        const fetchFinal = async () => {
          const result = (await api.getAssignment(assignmentId)) as { success: boolean; data: Assignment };
          if (result.success) {
            if (result.data.status !== "completed" && retries < 5) {
              retries++;
              setTimeout(fetchFinal, 1000);
            } else {
              // Atomically sets paper data + status to "completed" in one render
              setCurrentAssignment(result.data);
            }
          }
        };
        fetchFinal();
      } else {
        // Only update status directly for non-completed events (pending, processing)
        setStatusUpdate(data.status, data.message, data.progress);
      }
    });

    socket.on("generation_failed", (data: StatusUpdate) => {
      console.error("🚨 Generation permanently failed:", data);
      setStatusUpdate("failed", data.message);
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
