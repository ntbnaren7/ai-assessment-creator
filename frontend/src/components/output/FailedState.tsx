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
    <div 
      className="loading-overlay animate-fadeIn"
      style={{
        fontFamily: "var(--font-bricolage), sans-serif",
      }}
    >
      <h2 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "16px", letterSpacing: "-0.02em" }}>
        Generation Failed
      </h2>
      <p className="loading-text" style={{ maxWidth: 600, wordBreak: "break-word", opacity: 0.8, marginBottom: "32px", lineHeight: "1.6", fontSize: "1.1rem" }}>
        {(() => {
          if (!message) return "An unexpected error occurred. Please try again.";
          
          switch (message) {
            case "QUOTA_EXHAUSTED":
              return "The AI providers have exhausted their daily free-tier quota. Please try again tomorrow or upgrade the account.";
            case "PROVIDER_TIMEOUT":
              return "The AI generation took too long and timed out. The request might have been too large or the provider is currently overloaded.";
            case "RATE_LIMITED":
              return "The AI service is currently experiencing high traffic and rate-limiting our requests. Please wait a few minutes and try again.";
            case "GENERATION_FAILED":
              return "We encountered a fatal error while trying to generate the assessment. Please try again.";
            default:
              // Fallback for older raw errors that haven't been normalized yet
              return message.length > 200 ? message.substring(0, 200) + "..." : message;
          }
        })()}
      </p>
      <div style={{ display: "flex", gap: "16px" }}>
        <button
          className="sidebar-create-btn"
          style={{ width: "auto", margin: 0, padding: "0 32px", height: "48px", fontFamily: "var(--font-bricolage), sans-serif" }}
          onClick={onRetry}
          disabled={isRetrying}
          type="button"
        >
          {isRetrying ? "Regenerating..." : "Try Again"}
        </button>
        <button 
          className="btn btn-secondary" 
          style={{ borderRadius: "100px", height: "48px", padding: "0 32px", fontFamily: "var(--font-bricolage), sans-serif" }}
          onClick={onNew} 
          type="button"
        >
          New Assignment
        </button>
      </div>
    </div>
  );
}
