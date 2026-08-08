import { env } from "@/lib/env";
import { tokenStore } from "@/lib/auth/token-store";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

function unwrap<T>(body: unknown): T {
  if (
    body &&
    typeof body === "object" &&
    "success" in body &&
    "data" in body
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function isPaginated(body: unknown): body is {
  data: unknown[];
  meta: PaginationMeta;
} {
  return (
    body !== null &&
    typeof body === "object" &&
    Array.isArray((body as { data?: unknown }).data) &&
    "meta" in (body as Record<string, unknown>)
  );
}

interface ApiErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

function normalizeError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const err = body as ApiErrorBody;
    if (err.message) {
      const message = Array.isArray(err.message)
        ? err.message.join(". ")
        : err.message;
      return new ApiError(status, message, err.error);
    }
  }
  return new ApiError(status, `Request failed with status ${status}`);
}

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
  retryOnAuth?: boolean;
}

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) {
    throw new ApiError(401, "Session expired. Please sign in again.");
  }
  refreshInFlight = (async () => {
    const response = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      tokenStore.clear();
      const body = await response.json().catch(() => null);
      throw normalizeError(response.status, body);
    }
    const data = unwrap<{
      accessToken: string;
      refreshToken: string;
    }>(await response.json());
    tokenStore.setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function requestRaw(
  path: string,
  options: ApiRequestOptions = {},
): Promise<unknown> {
  const { body, auth = true, retryOnAuth = true, headers, ...rest } = options;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = tokenStore.getAccessToken();
    if (token) {
      finalHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const url = `${env.apiUrl}${path}`;
  const requestBody = body !== undefined ? JSON.stringify(body) : undefined;

  const response = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: requestBody,
  });

  if (response.status === 401 && auth && retryOnAuth) {
    const newToken = await refreshAccessToken();
    finalHeaders.set("Authorization", `Bearer ${newToken}`);
    const retryResponse = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: requestBody,
    });
    if (!retryResponse.ok) {
      const errorBody = await retryResponse.json().catch(() => null);
      throw normalizeError(retryResponse.status, errorBody);
    }
    if (retryResponse.status === 204) {
      return undefined;
    }
    return retryResponse.json();
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw normalizeError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return unwrap<T>(await requestRaw(path, options));
}

export async function apiFetchPaginated<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<PaginatedResult<T>> {
  const body = await requestRaw(path, options);
  if (isPaginated(body)) {
    return { data: body.data as T[], meta: body.meta };
  }
  throw new ApiError(500, "Malformed paginated response from the server.");
}
