import type { AuthResponse, Envelope, User } from "@/types/api";
import { request } from "./client";

export interface Credentials {
  email: string;
  password: string;
}

/** POST /auth/login -> 200 { token, data.user }. 401 INVALID_CREDENTIALS. */
export async function login(creds: Credentials): Promise<{ token: string; user: User }> {
  const res = await request<AuthResponse>("/auth/login", { method: "POST", body: creds, auth: false });
  return { token: res.body.token, user: res.body.data.user };
}

/** POST /auth/register -> 201 { token, data.user }. 409 CONFLICT when the email exists. */
export async function register(creds: Credentials): Promise<{ token: string; user: User }> {
  const res = await request<AuthResponse>("/auth/register", { method: "POST", body: creds, auth: false });
  return { token: res.body.token, user: res.body.data.user };
}

/** GET /auth/me -> the signed-in user (email and role come from the server, never the token). */
export async function me(signal?: AbortSignal): Promise<User> {
  const res = await request<Envelope<{ user: User }>>("/auth/me", { signal });
  return res.body.data.user;
}

// Access tokens are short-lived (JWT_EXPIRES_IN, 1h by default) and there is no refresh token,
// so signing out discards the token locally and the server-side token simply expires.
