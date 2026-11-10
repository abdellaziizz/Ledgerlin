import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/contexts/AuthContext";

/** UX guard only — every protected endpoint is authorised by the backend regardless. */
export function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { session } = useAuth();
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Auditor-only screens. The backend enforces the role too (403 for customers). */
export function AuditorRoute() {
  const { session } = useAuth();
  if (session?.role !== "auditor") return <Navigate to="/" replace />;
  return <Outlet />;
}
