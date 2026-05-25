const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface FetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Base API client with error handling and timeout support.
 */
async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...fetchOptions.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }

    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create a new assignment (with optional file upload via FormData).
 */
export async function createAssignment(formData: FormData) {
  return apiClient("/assignments", {
    method: "POST",
    body: formData,
    // Do NOT set Content-Type — browser sets multipart boundary automatically
  });
}

/**
 * Get a single assignment by ID.
 */
export async function getAssignment(id: string) {
  return apiClient(`/assignments/${id}`);
}

/**
 * List all assignments.
 */
export async function listAssignments() {
  return apiClient("/assignments");
}

/**
 * Regenerate the question paper for an assignment.
 */
export async function regenerateAssignment(id: string) {
  return apiClient(`/assignments/${id}/regenerate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Delete an assignment by ID.
 */
export async function deleteAssignment(id: string) {
  return apiClient(`/assignments/${id}`, {
    method: "DELETE",
  });
}
