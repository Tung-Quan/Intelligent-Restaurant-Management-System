import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import KitchenPage from "./pages/KitchenPage";
import TablesPage from "./pages/TablesPage";
import ReservationsPage from "./pages/ReservationsPage";
import BillingPage from "./pages/BillingPage";
import InventoryPage from "./pages/InventoryPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

type AppRole = "admin" | "manager" | "server" | "chef" | "cashier" | "host";

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
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
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
