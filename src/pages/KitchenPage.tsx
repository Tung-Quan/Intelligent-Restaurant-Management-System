import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, ChefHat } from "lucide-react";

interface KitchenOrder {
  id: string;
  created_at: string;
  special_instructions: string | null;
  order_items: {
    id: string;
    quantity: number;
    status: string;
    notes: string | null;
    menu_items: { name: string; prep_time_minutes: number | null } | null;
  }[];
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, created_at, special_instructions, order_items(id, quantity, status, notes, menu_items(name, prep_time_minutes))")
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: true });
    if (data) setOrders(data as any);
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel("kitchen-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    await supabase.from("order_items").update({ status: newStatus }).eq("id", itemId);
    fetchOrders();
  };

  const statusFlow: Record<string, string> = {
    pending: "preparing",
    preparing: "cooking",
    cooking: "ready",
  };

  const timeSince = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <div>
      <PageHeader title="Kitchen Display" description="Real-time order preparation tracking" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map((order) => (
          <Card key={order.id} className="animate-fade-in">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-primary" />
                  <span className="font-heading font-bold text-sm">#{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {timeSince(order.created_at)}
                </div>
              </div>

              {order.special_instructions && (
                <p className="text-xs text-warning bg-warning/10 rounded-md p-2">⚠ {order.special_instructions}</p>
              )}

              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.quantity}x {item.menu_items?.name}</span>
                      {item.notes && <p className="text-xs text-muted-foreground truncate">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={item.status} />
                      {statusFlow[item.status] && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                          onClick={() => updateItemStatus(item.id, statusFlow[item.status])}
                        >
                          → {statusFlow[item.status]}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No active orders in the kitchen
          </div>
        )}
      </div>
    </div>
  );
}
