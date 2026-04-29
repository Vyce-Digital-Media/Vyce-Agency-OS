const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "/api";

type ApiOptions = RequestInit & {
  token?: string | null;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const payload = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new ApiError(payload?.message || payload?.error || "API request failed", response.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) => apiRequest<T>(path, { method: "GET", token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    apiRequest<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}), token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}), token }),
  delete: <T>(path: string, token?: string | null) => apiRequest<T>(path, { method: "DELETE", token }),
};
