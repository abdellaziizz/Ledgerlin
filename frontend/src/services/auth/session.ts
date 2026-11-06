/**
 * Session storage for the access token.
 *
 * The backend returns a bearer JWT in the JSON body of /auth/login and /auth/register
 * (it does not set a cookie, although `protect` would also read a `jwt` cookie).
 * We keep it in sessionStorage: it survives a reload but not closing the tab, and it
 * is never written to logs. Passwords are never stored anywhere.
 *
 * The token payload carries only { id, iat, exp } — no role and no email — so the
 * email shown in the UI is the one the person typed when signing in.
 */

const KEY = "ledgerline:session";

export interface Session {
  token: string;
  userId: string;
  email: string;
  issuedAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

interface JwtPayload {
  id?: unknown;
  iat?: unknown;
  exp?: unknown;
}

/** Reads the (unverified) JWT payload for display and expiry only; the server is the authority. */
export function decodeToken(token: string): { userId: string; issuedAt: number; expiresAt: number } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const payload = JSON.parse(json) as JwtPayload;
    if (typeof payload.id !== "string" || typeof payload.exp !== "number") return null;
    return {
      userId: payload.id,
      issuedAt: typeof payload.iat === "number" ? payload.iat * 1000 : Date.now(),
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

export function createSession(token: string, email: string): Session | null {
  const decoded = decodeToken(token);
  if (!decoded) return null;
  return { token, email, ...decoded };
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || s.expiresAt <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}

// The API client reads the token through this module-level handle so no component
// has to pass it around.
let current: Session | null = loadSession();
export const sessionStore = {
  get: () => current,
  set: (s: Session | null) => {
    current = s;
    if (s) saveSession(s);
    else clearSession();
  },
};
