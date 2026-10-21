// Shared fetcher for TanStack Query: JSON in, JSON out, and a typed error carrying the HTTP
// status so callers (and the retry policy) can tell "not allowed" from "server down".

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return body as T;
}

// 4xx won't change by retrying (auth, permission, validation): fail fast. Network errors
// and 5xx get one more attempt.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}
