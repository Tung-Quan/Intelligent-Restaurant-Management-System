export type AppRole = "admin" | "manager" | "server" | "chef" | "cashier" | "host";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  roles: AppRole[];
}

interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: ApiErrorPayload | null;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1").replace(/\/$/, "");
const ACCESS_TOKEN_KEY = "irms.access_token";
const REFRESH_TOKEN_KEY = "irms.refresh_token";

export class ApiClientError extends Error {
  code?: string;
  details?: unknown;
  status?: number;

  constructor(message: string, options?: { code?: string; details?: unknown; status?: number }) {
    super(message);
    this.name = "ApiClientError";
    this.code = options?.code;
    this.details = options?.details;
    this.status = options?.status;
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken?: string | null) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit & { auth?: boolean }) {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined;
  const wantsAuth = init?.auth !== false;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (wantsAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as ApiResponse<T>)
    : null;

  if (!response.ok || !payload?.success) {
    const error = payload?.error;
    throw new ApiClientError(
      error?.message || `Request failed with status ${response.status}`,
      { code: error?.code, details: error?.details, status: response.status }
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "GET" }),
  post: <T>(path: string, body?: unknown, init?: RequestInit & { auth?: boolean }) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string, init?: RequestInit) => request<T>(path, { ...init, method: "DELETE" }),
};
