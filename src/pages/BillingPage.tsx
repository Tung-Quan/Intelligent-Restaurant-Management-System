import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, Smartphone } from "lucide-react";

interface Order {
  id: string;
  total_amount: number;
  subtotal: number;
  tax: number;
  discount: number;
  payment_status: string;
  payment_method: string | null;
  status: string;
  created_at: string;
  items: { quantity: number; unit_price: number; menu_item_name: string }[];
}

export default function BillingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = async () => {
    try {
      const data = await api.get<Order[]>("/billing/orders?status=ready,served,completed&include=items,items.menu_item");
      setOrders(data);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => { void fetchOrders(); }, []);

  const processPayment = async (orderId: string, method: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    await api.post(`/billing/orders/${orderId}/payments`, {
      method,
      amount: Number(order.total_amount),
    });
    toast({ title: "Payment processed!" });
    await fetchOrders();
  };

  return (
    <div>
      <PageHeader title="Billing & Payments" description="Process payments and manage bills" />
      <div className="space-y-3">
        {initialLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={`billing-skeleton-${index}`} className="animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="w-full max-w-xl space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <div className="flex gap-1">
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        {!initialLoading && orders.map((order) => (
          <Card key={order.id} className="animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading font-bold">Order #{order.id.slice(0, 8)}</p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {order.items.map((item, i) => (
                      <p key={i}>{item.quantity}x {item.menu_item_name} — ${(item.quantity * Number(item.unit_price)).toFixed(2)}</p>
                    ))}
                  </div>
                  <div className="mt-2 text-sm space-y-0.5">
                    <p>Subtotal: ${Number(order.subtotal).toFixed(2)}</p>
                    <p>Tax: ${Number(order.tax).toFixed(2)}</p>
                    {Number(order.discount) > 0 && <p>Discount: -${Number(order.discount).toFixed(2)}</p>}
                    <p className="font-bold text-base">Total: ${Number(order.total_amount).toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={order.payment_status} />
                  {order.payment_status === "unpaid" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => processPayment(order.id, "cash")}>
                        <Banknote className="h-3 w-3 mr-1" /> Cash
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => processPayment(order.id, "card")}>
                        <CreditCard className="h-3 w-3 mr-1" /> Card
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => processPayment(order.id, "digital")}>
                        <Smartphone className="h-3 w-3 mr-1" /> Digital
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!initialLoading && orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No orders ready for billing</div>
        )}
      </div>
    </div>
  );
}
