import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, ChefHat } from "lucide-react";

interface KitchenOrder {
  id: string;
  created_at: string;
  deadline_at: string;
  visual_alert: "new" | "on_track" | "due_soon" | "overdue";
  special_instructions: string | null;
  items: {
    id: string;
    quantity: number;
    status: string;
    notes: string | null;
    station: string;
    deadline_at: string;
    menu_item: { name: string; prep_time_minutes: number | null; category?: string | null } | null;
  }[];
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const data = await api.get<KitchenOrder[]>("/kitchen/orders?status=pending,in_progress");
      setOrders(data);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, []);

  useRealtimeSync(["orders.created.for_kds", "orders.status_updated"], () => {
    void fetchOrders();
  });

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    await api.patch(`/order-items/${itemId}/status`, { status: newStatus });
    await fetchOrders();
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

  const timeUntil = (dateStr: string) => {
    const mins = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 60000);
    if (mins < 0) return `${Math.abs(mins)}m late`;
    return mins < 60 ? `${mins}m left` : `${Math.floor(mins / 60)}h ${mins % 60}m left`;
  };

  const alertClass: Record<KitchenOrder["visual_alert"], string> = {
    new: "border-primary/40 bg-primary/5",
    on_track: "",
    due_soon: "border-warning/60 bg-warning/10",
    overdue: "border-destructive/60 bg-destructive/10",
  };

  return (
    <div>
      <PageHeader title="Kitchen Display" description="Real-time order preparation tracking" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {initialLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={`kitchen-skeleton-${index}`} className="animate-fade-in">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-10 w-full" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((__, itemIndex) => (
                    <div key={`kitchen-item-skeleton-${index}-${itemIndex}`} className="flex items-center justify-between gap-2">
                      <div className="w-full space-y-1">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-7 w-24 rounded-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        {!initialLoading && orders.map((order) => (
          <Card key={order.id} className={`animate-fade-in ${alertClass[order.visual_alert]}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ChefHat className="h-4 w-4 text-primary" />
                  <span className="font-heading font-bold text-sm">#{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {timeSince(order.created_at)} / {timeUntil(order.deadline_at)}
                </div>
              </div>

              {order.visual_alert !== "on_track" && (
                <div className="rounded-md bg-background/80 px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                  {order.visual_alert.replace("_", " ")}
                </div>
              )}

              {order.special_instructions && (
                <p className="text-xs text-warning bg-warning/10 rounded-md p-2">⚠ {order.special_instructions}</p>
              )}

              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{item.quantity}x {item.menu_item?.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {item.station} · {timeUntil(item.deadline_at)}
                      </p>
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
                          {statusFlow[item.status]}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {!initialLoading && orders.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No active orders in the kitchen
          </div>
        )}
      </div>
    </div>
  );
}
