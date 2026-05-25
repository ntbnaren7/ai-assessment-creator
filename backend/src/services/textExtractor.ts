import pdf from "pdf-parse";

/**
 * Extracts text content from an uploaded file buffer.
 * Supports PDF and plain text files.
 */
export async function extractTextFromFile(
  buffer: Buffer,
  mimetype: string
): Promise<string> {
  if (mimetype === "text/plain") {
    return buffer.toString("utf-8").trim();
  }

  if (mimetype === "application/pdf") {
    const data = await pdf(buffer);
    return data.text.trim();
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}
