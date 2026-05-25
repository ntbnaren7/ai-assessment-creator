"use client";

interface LoadingStateProps {
  status: "pending" | "processing";
  message?: string;
}

/**
 * Pulsing loading screen shown while the AI generates the question paper.
 */
export function LoadingState({ status, message }: LoadingStateProps) {
  return (
    <div className="loading-overlay animate-fadeIn">
      <div className="pulse-icon">
        <span>🧠</span>
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ marginBottom: "var(--space-2)" }}>
          {status === "pending" ? "Queued" : "Generating..."}
        </h2>
        <p className="loading-text">
          {message ||
            "Your question paper is being crafted by AI. Hang tight!"}
        </p>
      </div>
      <span className={`badge badge-status badge-${status}`}>
        {status.toUpperCase()}
      </span>
    </div>
  );
}
