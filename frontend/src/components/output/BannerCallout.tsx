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
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 12H12V13.3333H4V12ZM12 6.66667H9.33333V2.66667H6.66667V6.66667H4L8 10.6667L12 6.66667Z" fill="currentColor"/>
        </svg>
        Download as PDF
      </button>
    </div>
  );
}
