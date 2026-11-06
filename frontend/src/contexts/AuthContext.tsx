import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as authApi from "@/services/api/auth";
import { setUnauthorizedHandler } from "@/services/api/client";
import { ApiError } from "@/services/api/errors";
import { createSession, sessionStore, type Session } from "@/services/auth/session";

interface AuthContextValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: (reason?: "expired") => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// setTimeout overflows above ~24.8 days; long-lived tokens are re-checked periodically instead.
const MAX_TIMER = 2 ** 31 - 1;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => sessionStore.get());
  const queryClient = useQueryClient();

  const logout = useCallback(
    (reason?: "expired") => {
      // TODO: Not implemented yet - no backend logout/revocation endpoint; the token is only discarded locally.
      sessionStore.set(null);
      setSession(null);
      queryClient.clear();
      if (reason === "expired") toast.error("Your session ended. Please sign in again.");
    },
    [queryClient],
  );

  const establish = useCallback((token: string, email: string) => {
    const s = createSession(token, email);
    if (!s) throw new ApiError({ kind: "http", message: "The server returned an unreadable session token." });
    sessionStore.set(s);
    setSession(s);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();
      establish(await authApi.login({ email: normalized, password }), normalized);
    },
    [establish],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const normalized = email.trim().toLowerCase();
      establish(await authApi.register({ email: normalized, password }), normalized);
    },
    [establish],
  );

  useEffect(() => {
    setUnauthorizedHandler(() => logout("expired"));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // End the session locally when the token's exp passes.
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    if (ms <= 0) {
      logout("expired");
      return;
    }
    const t = setTimeout(() => {
      if (sessionStore.get()?.expiresAt && sessionStore.get()!.expiresAt <= Date.now()) logout("expired");
    }, Math.min(ms, MAX_TIMER));
    return () => clearTimeout(t);
  }, [session, logout]);

  const value = useMemo(() => ({ session, login, register, logout }), [session, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** For screens behind ProtectedRoute, where a session is guaranteed. */
export function useSession(): Session {
  const { session } = useAuth();
  if (!session) throw new Error("useSession used outside a protected route");
  return session;
}
