import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function AnalyticsPage() {
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; count: number }[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; total: number }[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number }[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [statusData, topItemData, revenueData] = await Promise.all([
          api.get<{ name: string; count: number }[]>("/analytics/orders-by-status"),
          api.get<{ name: string; total: number }[]>("/analytics/top-items?limit=10"),
          api.get<{ date: string; revenue: number }[]>("/analytics/daily-revenue?days=7"),
        ]);

        setOrdersByStatus(statusData);
        setTopItems(topItemData);
        setDailyRevenue(revenueData);
      } finally {
        setInitialLoading(false);
      }
    };
    void fetchAnalytics();
  }, []);

  const COLORS = ["hsl(24, 95%, 53%)", "hsl(160, 60%, 40%)", "hsl(210, 80%, 55%)", "hsl(45, 93%, 47%)", "hsl(0, 84%, 60%)", "hsl(220, 30%, 50%)"];

  return (
    <div>
      <PageHeader title="Analytics" description="Sales and operational insights" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="animate-fade-in">
          <CardHeader><CardTitle className="font-heading text-base">Daily Revenue (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            {initialLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : dailyRevenue.length > 0 ? (
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
            {initialLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : ordersByStatus.length > 0 ? (
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
            {initialLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : topItems.length > 0 ? (
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
