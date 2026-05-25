"use client";

interface FailedStateProps {
  message?: string;
  onRetry: () => void;
  onNew: () => void;
  isRetrying?: boolean;
}

/**
 * Error state shown when question paper generation fails.
 */
export function FailedState({
  message,
  onRetry,
  onNew,
  isRetrying,
}: FailedStateProps) {
  return (
    <div className="loading-overlay animate-fadeIn">
      <span style={{ fontSize: "3rem" }}>😞</span>
      <h2>Generation Failed</h2>
      <p className="loading-text" style={{ maxWidth: 400 }}>
        {message || "An unexpected error occurred. Please try again."}
      </p>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <button
          className="btn btn-primary"
          onClick={onRetry}
          disabled={isRetrying}
          type="button"
        >
          {isRetrying ? "Regenerating..." : "🔄 Try Again"}
        </button>
        <button className="btn btn-secondary" onClick={onNew} type="button">
          ← New Assignment
        </button>
      </div>
    </div>
  );
}
