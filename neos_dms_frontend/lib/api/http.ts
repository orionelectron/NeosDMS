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
    const data = (await response.json()) as {
      tokens: { accessToken: string; refreshToken: string };
    };
    tokenStore.setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return data.tokens.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
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

  const response = await fetch(url, { ...rest, headers: finalHeaders, body: requestBody });

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
      return undefined as T;
    }
    return (await retryResponse.json()) as T;
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw normalizeError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
