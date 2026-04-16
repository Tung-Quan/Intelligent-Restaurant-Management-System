import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import type { AppRole } from "@/lib/api";
import { AppLayout } from "@/components/AppLayout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import MenuPage from "./pages/MenuPage";
import KitchenPage from "./pages/KitchenPage";
import TablesPage from "./pages/TablesPage";
import ReservationsPage from "./pages/ReservationsPage";
import BillingPage from "./pages/BillingPage";
import InventoryPage from "./pages/InventoryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const LAST_ROUTE_STORAGE_KEY = "irms.last_route";

function PersistRoute() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/auth") {
      const nextPath = `${location.pathname}${location.search}${location.hash}`;
      sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, nextPath);
    }
  }, [location]);

  return null;
}

function RoleGuard({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { roles: userRoles, hasRole, loading } = useAuth();
  if (loading) return null;
  // If user has no roles, allow access (graceful fallback for first user)
  if (userRoles.length === 0) return <>{children}</>;
  if (roles.some((r) => hasRole(r))) return <>{children}</>;
  return <Navigate to="/" replace />;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem(LAST_ROUTE_STORAGE_KEY, nextPath);
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return (
    <AppLayout>
      <PersistRoute />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/orders" element={<RoleGuard roles={["admin", "manager", "server", "cashier"]}><OrdersPage /></RoleGuard>} />
        <Route path="/kitchen" element={<RoleGuard roles={["admin", "manager", "chef"]}><KitchenPage /></RoleGuard>} />
        <Route path="/tables" element={<RoleGuard roles={["admin", "manager", "server", "host"]}><TablesPage /></RoleGuard>} />
        <Route path="/reservations" element={<RoleGuard roles={["admin", "manager", "server", "host"]}><ReservationsPage /></RoleGuard>} />
        <Route path="/billing" element={<RoleGuard roles={["admin", "manager", "cashier"]}><BillingPage /></RoleGuard>} />
        <Route path="/inventory" element={<RoleGuard roles={["admin", "manager"]}><InventoryPage /></RoleGuard>} />
        <Route path="/analytics" element={<RoleGuard roles={["admin", "manager"]}><AnalyticsPage /></RoleGuard>} />
        <Route path="/admin" element={<RoleGuard roles={["admin"]}><AdminPage /></RoleGuard>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

function AuthRoute() {
  const location = useLocation();
  const { user, loading } = useAuth();

  const rememberedPath = sessionStorage.getItem(LAST_ROUTE_STORAGE_KEY);
  const state = location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null;
  const nextPathFromState = state?.from
    ? `${state.from.pathname || "/"}${state.from.search || ""}${state.from.hash || ""}`
    : null;
  const nextPath = nextPathFromState || rememberedPath || "/";

  if (loading) return null;
  if (user) return <Navigate to={nextPath} replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
