import pdf from "pdf-parse";

import fs from "fs/promises";

/**
 * Extracts text content from an uploaded file on disk.
 * Supports PDF and plain text files.
 */
export async function extractTextFromFile(
  filePath: string,
  mimetype: string
): Promise<string> {
  const buffer = await fs.readFile(filePath);

  if (mimetype === "text/plain") {
    return buffer.toString("utf-8").trim();
  }

  if (mimetype === "application/pdf") {
    const data = await pdf(buffer);
    return data.text.trim();
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}
