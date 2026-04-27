import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, Smartphone, Split } from "lucide-react";

interface Order {
  id: string;
  table_id: string | null;
  total_amount: number;
  subtotal: number;
  tax: number;
  discount: number;
  tip_amount: number;
  promotion_code: string | null;
  payment_status: string;
  payment_method: string | null;
  status: string;
  created_at: string;
  split_bill?: {
    mode: "even" | "items";
    shares: {
      party_name: string;
      total_amount: number;
    }[];
  } | null;
  items: { id: string; quantity: number; unit_price: number; menu_item_name: string }[];
}

export default function BillingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<Record<string, { tip: string; promotionCode: string }>>({});
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
    const options = paymentOptions[orderId] ?? { tip: "0", promotionCode: "" };
    const tipAmount = Number(options.tip || 0);
    const promotionCode = options.promotionCode.trim();
    const promotionDiscount = promotionCode.toUpperCase() === "SAVE10"
      ? Number(order.subtotal) * 0.1
      : promotionCode.toUpperCase() === "SAVE5"
        ? Math.min(5, Number(order.subtotal) + Number(order.tax))
        : 0;
    const payableAmount = Math.max(
      0,
      Number(order.subtotal) + Number(order.tax) - promotionDiscount + tipAmount,
    );

    await api.post(`/billing/orders/${orderId}/payments`, {
      method,
      amount: Number(payableAmount.toFixed(2)),
      tip_amount: Number(tipAmount.toFixed(2)),
      promotion_code: promotionCode || undefined,
    });
    if (order.table_id) {
      await api.patch(`/tables/${order.table_id}/status`, { status: "available" });
    }
    toast({ title: "Payment processed!" });
    await fetchOrders();
  };

  const splitEvenly = async (orderId: string) => {
    await api.post(`/billing/orders/${orderId}/split-bill`, {
      mode: "even",
      guest_count: 2,
    });
    toast({ title: "Bill split evenly" });
    await fetchOrders();
  };

  const splitByItems = async (order: Order) => {
    const parties = [
      {
        party_name: "Guest 1",
        item_ids: order.items.filter((_, index) => index % 2 === 0).map((item) => item.id),
      },
      {
        party_name: "Guest 2",
        item_ids: order.items.filter((_, index) => index % 2 === 1).map((item) => item.id),
      },
    ].filter((party) => party.item_ids.length > 0);

    if (parties.length < 2) {
      toast({
        title: "Cannot split by items",
        description: "This order needs at least two items for an item-based split.",
        variant: "destructive",
      });
      return;
    }

    await api.post(`/billing/orders/${order.id}/split-bill`, {
      mode: "items",
      parties,
    });
    toast({ title: "Bill split by items" });
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
                    {Number(order.tip_amount) > 0 && <p>Tip: ${Number(order.tip_amount).toFixed(2)}</p>}
                    {order.promotion_code && <p>Promotion: {order.promotion_code}</p>}
                    <p className="font-bold text-base">Total: ${Number(order.total_amount).toFixed(2)}</p>
                    {order.split_bill && (
                      <div className="pt-2 text-xs">
                        <p className="font-semibold uppercase text-muted-foreground">
                          Split: {order.split_bill.mode}
                        </p>
                        {order.split_bill.shares.map((share) => (
                          <p key={share.party_name}>
                            {share.party_name}: ${Number(share.total_amount).toFixed(2)}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={order.payment_status} />
                  {order.payment_status === "unpaid" && (
                    <div className="flex flex-col items-end gap-2">
                      <div className="grid w-56 grid-cols-2 gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Tip"
                          value={paymentOptions[order.id]?.tip ?? "0"}
                          onChange={(event) =>
                            setPaymentOptions((prev) => ({
                              ...prev,
                              [order.id]: {
                                tip: event.target.value,
                                promotionCode: prev[order.id]?.promotionCode ?? "",
                              },
                            }))
                          }
                        />
                        <Input
                          placeholder="Promo"
                          value={paymentOptions[order.id]?.promotionCode ?? ""}
                          onChange={(event) =>
                            setPaymentOptions((prev) => ({
                              ...prev,
                              [order.id]: {
                                tip: prev[order.id]?.tip ?? "0",
                                promotionCode: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => splitEvenly(order.id)}>
                          <Split className="h-3 w-3 mr-1" /> Even
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => splitByItems(order)}>
                          <Split className="h-3 w-3 mr-1" /> Items
                        </Button>
                      </div>
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
