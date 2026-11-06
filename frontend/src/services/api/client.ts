import { env } from "@/config/env";
import { sessionStore } from "@/services/auth/session";
import type { ApiErrorBody } from "@/types/api";
import { ApiError, errorFromResponse } from "./errors";

type Method = "GET" | "POST";

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined | null>;
  /** Attach the bearer token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  status: number;
  headers: Headers;
  body: T;
}

let onUnauthorized: (() => void) | null = null;
/** Registered by AuthProvider: a 401 on an authenticated call ends the session. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = `${env.apiBaseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** The single place that calls fetch(). */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {}, query, auth = true, signal } = opts;
  const h: Record<string, string> = { Accept: "application/json", ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  const session = sessionStore.get();
  if (auth && session) h.Authorization = `Bearer ${session.token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: "same-origin",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError({ kind: "aborted", message: "Request cancelled" });
    }
    throw new ApiError({ kind: "network", message: "Couldn't reach Ledgerline. Check your connection and try again." });
  }

  // Unknown routes return Express's HTML 404 page, so JSON parsing must be tolerant.
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const error = errorFromResponse(res.status, parsed as Partial<ApiErrorBody> | null);
    if (res.status === 401 && auth && session) onUnauthorized?.();
    throw error;
  }
  if (parsed === null) {
    throw new ApiError({ kind: "http", status: res.status, message: "The server sent an unexpected response." });
  }
  return { status: res.status, headers: res.headers, body: parsed as T };
}
