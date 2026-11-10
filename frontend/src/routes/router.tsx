import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { AuditorRoute, ProtectedRoute, PublicOnlyRoute } from "./guards";

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage"));
const AccountsPage = lazy(() => import("@/pages/accounts/AccountsPage"));
const AccountDetailPage = lazy(() => import("@/pages/accounts/AccountDetailPage"));
const TransfersPage = lazy(() => import("@/pages/transfers/TransfersPage"));
const StatementPage = lazy(() => import("@/pages/statements/StatementPage"));
const ReconcilePage = lazy(() => import("@/pages/audit/ReconcilePage"));
const SettingsPage = lazy(() => import("@/pages/settings/SettingsPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
const page = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: page(<LoginPage />) },
      { path: "/register", element: page(<RegisterPage />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: page(<DashboardPage />) },
          { path: "accounts", element: page(<AccountsPage />) },
          { path: "accounts/:id", element: page(<AccountDetailPage />) },
          { path: "transfers", element: page(<TransfersPage />) },
          { path: "statements", element: page(<StatementPage />) },
          { element: <AuditorRoute />, children: [{ path: "audit", element: page(<ReconcilePage />) }] },
          { path: "settings", element: page(<SettingsPage />) },
          { path: "*", element: page(<NotFoundPage />) },
        ],
      },
    ],
  },
]);
