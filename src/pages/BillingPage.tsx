import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, CreditCard, Banknote, Smartphone } from "lucide-react";

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
  order_items: { quantity: number; unit_price: number; menu_items: { name: string } | null }[];
}

export default function BillingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(quantity, unit_price, menu_items(name))")
      .in("status", ["served", "completed", "ready"])
      .order("created_at", { ascending: false });
    if (data) setOrders(data as any);
  };

  useEffect(() => { fetchOrders(); }, []);

  const processPayment = async (orderId: string, method: string) => {
    await supabase.from("orders").update({
      payment_status: "paid",
      payment_method: method,
      status: "completed",
    }).eq("id", orderId);
    toast({ title: "Payment processed!" });
    fetchOrders();
  };

  return (
    <div>
      <PageHeader title="Billing & Payments" description="Process payments and manage bills" />
      <div className="space-y-3">
        {orders.map((order) => (
          <Card key={order.id} className="animate-fade-in">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading font-bold">Order #{order.id.slice(0, 8)}</p>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {order.order_items.map((item, i) => (
                      <p key={i}>{item.quantity}x {item.menu_items?.name} — ${(item.quantity * Number(item.unit_price)).toFixed(2)}</p>
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
        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No orders ready for billing</div>
        )}
      </div>
    </div>
  );
}
