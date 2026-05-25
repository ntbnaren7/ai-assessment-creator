"use client";

interface ProgressStepProps {
  /** Value between 0 and 100 */
  progress: number;
}

/**
 * Sleek horizontal progress bar shown at the top of the create assignment form.
 */
export function ProgressStep({ progress }: ProgressStepProps) {
  return (
    <div className="progress-bar">
      <div
        className="progress-bar-fill"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  );
}
