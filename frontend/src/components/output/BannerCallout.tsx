"use client";

interface BannerCalloutProps {
  message: string;
  onDownloadPDF: () => void;
}

/**
 * Dark charcoal banner at the top of the output page.
 * Shows a personalised message and a Download as PDF button.
 */
export function BannerCallout({ message, onDownloadPDF }: BannerCalloutProps) {
  return (
    <div className="banner-callout animate-fadeIn">
      <p className="banner-callout-text">{message}</p>
      <button
        className="btn-download"
        type="button"
        onClick={onDownloadPDF}
      >
        <span>📥</span>
        Download as PDF
      </button>
    </div>
  );
}
