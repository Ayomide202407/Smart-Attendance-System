const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

/**
 * Main JSON request helper (recommended).
 * - Accepts body as a normal JS object (auto JSON.stringify)
 * - Parses JSON response if present
 * - Throws readable errors for HTTP errors and { ok:false }
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit & { body?: any } = {}
): Promise<T> {
  const { body, headers, ...rest } = options;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: rest.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  // Try JSON first, but don't crash if backend returns non-json
  let data: any = null;
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { message: text } : null;
    }
  } catch {
    data = null;
  }

  // Handle HTTP-level errors
  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `HTTP ${res.status} ${res.statusText || ""}`.trim();
    throw new Error(msg);
  }

  // Handle app-level errors
  if (data && data.ok === false) {
    throw new Error(data.error || data.message || "API error");
  }

  return data as T;
}

/**
 * Backward compatibility helper:
 * - Keeps old code working if it used api(endpoint, options) already.
 * - In THIS helper, body should be pre-stringified if you pass it in options.
 *   (Prefer apiRequest which takes normal objects)
 */
export async function api<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data: any = null;
  const contentType = res.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { message: text } : null;
    }
  } catch {
    data = null;
  }

  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.error || data?.message || "API error");
  }

  return data as T;
}

// Default export so any `import apiRequest from "@/lib/api"` also works
export default apiRequest;
