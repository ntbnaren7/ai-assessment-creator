"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
}

/**
 * Drag-and-drop file upload zone matching the Figma design.
 * Shows upload icon, instructions, and Browse Files button.
 */
export function FileDropzone({ file, onFileChange }: FileDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    onFileChange(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0] || null;
    if (dropped) {
      onFileChange(dropped);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  if (file) {
    return (
      <div className={`file-upload-zone has-file`}>
        <div className="file-name">
          <span>📄</span>
          <span>{file.name}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              onFileChange(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            style={{ marginLeft: "var(--space-2)" }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="file-dropzone-wrapper">
      <div
        className={`file-upload-zone ${isDragging ? "dragging" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.jpeg,.jpg,.png"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <div className="file-upload-icon">
          <Image src="/assets/icons/icon-upload-cloud.svg" alt="Upload Cloud" width={32} height={32} style={{ objectFit: "contain" }} />
        </div>
        <div className="file-upload-text">
          Choose a file or drag &amp; drop it here
        </div>
        <div className="file-upload-hint">JPEG, PNG, upto 10MB</div>
        <button
          type="button"
          className="file-upload-browse-btn"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          Browse Files
        </button>
      </div>
      <div className="file-upload-subtext">
        Upload images of your preferred document/image
      </div>
    </div>
  );
}
