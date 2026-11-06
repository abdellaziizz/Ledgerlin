import type { AuthResponse } from "@/types/api";
import { request } from "./client";

export interface Credentials {
  email: string;
  password: string;
}

/** POST /auth/login -> 200 { status, token }. 401 "Incorrect email or password". */
export async function login(creds: Credentials): Promise<string> {
  const res = await request<AuthResponse>("/auth/login", { method: "POST", body: creds, auth: false });
  return res.body.token;
}

/** POST /auth/register -> 201 { status, token }. 409 CONFLICT when the email exists. */
export async function register(creds: Credentials): Promise<string> {
  const res = await request<AuthResponse>("/auth/register", { method: "POST", body: creds, auth: false });
  return res.body.token;
}

// TODO: Not implemented yet - the backend has no logout endpoint. Signing out clears the
// token client-side only; the JWT remains valid on the server until it expires (JWT_EXPIRES_IN).
// TODO: Not implemented yet - no "current user" endpoint (e.g. GET /auth/me), so the role
// (customer/auditor) and profile cannot be read from the backend.
