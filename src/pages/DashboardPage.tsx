import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed, Armchair, CalendarDays, Package, DollarSign, Clock, AlertTriangle } from "lucide-react";

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
    totalOrders: 0, activeOrders: 0, availableTables: 0,
    todayReservations: 0, lowStockItems: 0, todayRevenue: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const today = new Date().toISOString().split("T")[0];

      const [orders, tables, reservations, inventory, revenue] = await Promise.all([
        supabase.from("orders").select("id, status").gte("created_at", today),
        supabase.from("restaurant_tables").select("id, status"),
        supabase.from("reservations").select("id").gte("reservation_time", today).lt("reservation_time", today + "T23:59:59"),
        supabase.from("inventory_items").select("id, quantity, min_threshold"),
        supabase.from("orders").select("total_amount").eq("payment_status", "paid").gte("created_at", today),
      ]);

      setStats({
        totalOrders: orders.data?.length || 0,
        activeOrders: orders.data?.filter((o) => !["completed", "cancelled"].includes(o.status)).length || 0,
        availableTables: tables.data?.filter((t) => t.status === "available").length || 0,
        todayReservations: reservations.data?.length || 0,
        lowStockItems: inventory.data?.filter((i) => Number(i.quantity) <= Number(i.min_threshold)).length || 0,
        todayRevenue: revenue.data?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: "Today's Orders", value: stats.totalOrders, icon: UtensilsCrossed, color: "text-primary" },
    { label: "Active Orders", value: stats.activeOrders, icon: Clock, color: "text-info" },
    { label: "Available Tables", value: stats.availableTables, icon: Armchair, color: "text-success" },
    { label: "Reservations Today", value: stats.todayReservations, icon: CalendarDays, color: "text-info" },
    { label: "Low Stock Items", value: stats.lowStockItems, icon: AlertTriangle, color: "text-warning" },
    { label: "Today's Revenue", value: `$${stats.todayRevenue.toFixed(2)}`, icon: DollarSign, color: "text-success" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of restaurant operations" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className="animate-fade-in">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted ${card.color}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-heading font-bold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
