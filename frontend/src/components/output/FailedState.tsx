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
      <p className="loading-text" style={{ maxWidth: 600, wordBreak: "break-word" }}>
        {(() => {
          if (!message) return "An unexpected error occurred. Please try again.";
          
          try {
            // Check if it's a stringified JSON error
            const parsed = JSON.parse(message);
            if (parsed?.error?.message) {
              const apiMsg = parsed.error.message.toLowerCase();
              if (apiMsg.includes("quota") || apiMsg.includes("429")) {
                return "The AI service is currently experiencing high traffic or has exceeded its quota. Please try again later.";
              }
              return parsed.error.message;
            }
          } catch (e) {
            // Not JSON, continue to string matching
          }

          if (message.includes("exceeded your current quota") || message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
            return "The AI service is currently experiencing high traffic or has exceeded its quota. Please try again later.";
          }

          // Return original if it seems like a normal short message, otherwise truncate
          return message.length > 200 ? message.substring(0, 200) + "..." : message;
        })()}
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
