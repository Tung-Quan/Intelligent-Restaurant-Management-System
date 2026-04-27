import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiClientError } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { UtensilsCrossed, Armchair, CalendarDays, DollarSign, Clock, AlertTriangle } from "lucide-react";

interface Stats {
  totalOrders: number;
  activeOrders: number;
  availableTables: number;
  todayReservations: number;
  lowStockItems: number;
  todayRevenue: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalOrders: 0,
    activeOrders: 0,
    availableTables: 0,
    todayReservations: 0,
    lowStockItems: 0,
    todayRevenue: 0,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const { hasRole, roles } = useAuth();
  const canViewStats = roles.length === 0 || hasRole("admin") || hasRole("manager");

  useEffect(() => {
    if (!canViewStats) {
      setInitialLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        setStatsError(null);
        const today = new Date().toISOString().split("T")[0];
        const data = await api.get<{
          total_orders: number;
          active_orders: number;
          available_tables: number;
          today_reservations: number;
          low_stock_items: number;
          today_revenue: number;
        }>(`/dashboard/summary?date=${today}`);

        setStats({
          totalOrders: data.total_orders,
          activeOrders: data.active_orders,
          availableTables: data.available_tables,
          todayReservations: data.today_reservations,
          lowStockItems: data.low_stock_items,
          todayRevenue: data.today_revenue,
        });
      } catch (error) {
        const message = error instanceof ApiClientError
          ? error.message
          : "Dashboard summary is unavailable";
        setStatsError(message);
      } finally {
        setInitialLoading(false);
      }
    };
    void fetchStats();
  }, [canViewStats]);

  const cards = [
    { label: "Today's Orders", value: stats.totalOrders, icon: UtensilsCrossed, color: "text-primary" },
    { label: "Active Orders", value: stats.activeOrders, icon: Clock, color: "text-info" },
    { label: "Available Tables", value: stats.availableTables, icon: Armchair, color: "text-success" },
    { label: "Reservations Today", value: stats.todayReservations, icon: CalendarDays, color: "text-info" },
    { label: "Low Stock Items", value: stats.lowStockItems, icon: AlertTriangle, color: "text-warning" },
    { label: "Today's Revenue", value: `$${stats.todayRevenue.toFixed(2)}`, icon: DollarSign, color: "text-success" },
  ];

  const quickActions = useMemo(() => {
    if (hasRole("admin")) {
      return [
        { to: "/menu", label: "View Menu", helper: "Review dishes, pricing, and current availability" },
        { to: "/admin", label: "Open Admin Console", helper: "Manage staff roles, menu setup, and table configuration" },
        { to: "/analytics", label: "Review Analytics", helper: "Track operations and monitor service performance" },
        { to: "/inventory", label: "Check Inventory", helper: "Review low-stock items before service rush" },
      ];
    }

    if (hasRole("host")) {
      return [
        { to: "/menu", label: "View Menu", helper: "See dishes and pricing when guests ask what is available" },
        { to: "/reservations", label: "Review Reservations", helper: "Create reservations and review guest arrival details" },
        { to: "/tables", label: "Check Dining Room", helper: "Watch which tables are available, reserved, or occupied" },
      ];
    }

    return [
      { to: "/menu", label: "View Menu", helper: "Browse current dishes before taking or placing requests" },
      { to: "/orders", label: "Take Orders", helper: "Open active tickets and start a new table order" },
      { to: "/tables", label: "Check Tables", helper: "See which tables are open before service" },
    ];
  }, [hasRole]);

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of restaurant operations" />
      {canViewStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.label} className="animate-fade-in">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted ${card.color}`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  {initialLoading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="font-heading text-2xl font-bold">{card.value}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {statsError && (
        <Card className="mt-6 border-destructive/40">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span>{statsError}</span>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-base">Quick actions for your role</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {initialLoading
            ? Array.from({ length: quickActions.length }).map((_, index) => (
                <div key={`quick-action-skeleton-${index}`} className="rounded-xl border border-border p-4">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-1 h-4 w-4/5" />
                  <Skeleton className="mt-3 h-10 w-20" />
                </div>
              ))
            : quickActions.map((action) => (
                <div key={action.to} className="rounded-xl border border-border p-4">
                  <p className="font-medium">{action.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{action.helper}</p>
                  <Button asChild className="mt-3" variant="outline">
                    <Link to={action.to}>Open</Link>
                  </Button>
                </div>
              ))}
        </CardContent>
      </Card>
    </div>
  );
}
