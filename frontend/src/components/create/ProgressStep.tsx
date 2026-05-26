"use client";

interface ProgressStepProps {
  /** Value between 0 and 100 */
  progress: number;
}

/**
 * Sleek horizontal progress bar shown at the top of the create assignment form.
 */
export function ProgressStep({ progress }: ProgressStepProps) {
  const safeProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="progress-bar">
      {safeProgress > 0 && (
        <div
          className="progress-bar-fill"
          style={{ width: `${safeProgress}%` }}
        />
      )}
      {safeProgress < 100 && (
        <div className="progress-bar-track" />
      )}
    </div>
  );
}
