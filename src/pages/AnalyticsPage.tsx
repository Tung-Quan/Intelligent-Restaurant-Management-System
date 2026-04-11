import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function AnalyticsPage() {
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; count: number }[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; total: number }[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number }[]>([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Orders by status
      const { data: orders } = await supabase.from("orders").select("status");
      if (orders) {
        const counts: Record<string, number> = {};
        orders.forEach((o) => { counts[o.status] = (counts[o.status] || 0) + 1; });
        setOrdersByStatus(Object.entries(counts).map(([name, count]) => ({ name, count })));
      }

      // Top items
      const { data: items } = await supabase.from("order_items").select("quantity, menu_items(name)");
      if (items) {
        const totals: Record<string, number> = {};
        items.forEach((i: any) => {
          const name = i.menu_items?.name || "Unknown";
          totals[name] = (totals[name] || 0) + i.quantity;
        });
        setTopItems(
          Object.entries(totals)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
        );
      }

      // Daily revenue (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: paid } = await supabase.from("orders").select("total_amount, created_at").eq("payment_status", "paid").gte("created_at", sevenDaysAgo);
      if (paid) {
        const daily: Record<string, number> = {};
        paid.forEach((o) => {
          const date = new Date(o.created_at).toLocaleDateString();
          daily[date] = (daily[date] || 0) + Number(o.total_amount);
        });
        setDailyRevenue(Object.entries(daily).map(([date, revenue]) => ({ date, revenue })));
      }
    };
    fetchAnalytics();
  }, []);

  const COLORS = ["hsl(24, 95%, 53%)", "hsl(160, 60%, 40%)", "hsl(210, 80%, 55%)", "hsl(45, 93%, 47%)", "hsl(0, 84%, 60%)", "hsl(220, 30%, 50%)"];

  return (
    <div>
      <PageHeader title="Analytics" description="Sales and operational insights" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="animate-fade-in">
          <CardHeader><CardTitle className="font-heading text-base">Daily Revenue (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            {dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground text-sm">No revenue data yet</p>}
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardHeader><CardTitle className="font-heading text-base">Orders by Status</CardTitle></CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {ordersByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground text-sm">No order data yet</p>}
          </CardContent>
        </Card>

        <Card className="col-span-full animate-fade-in">
          <CardHeader><CardTitle className="font-heading text-base">Top Menu Items</CardTitle></CardHeader>
          <CardContent>
            {topItems.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topItems} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(160, 60%, 40%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-12 text-muted-foreground text-sm">No item data yet</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
