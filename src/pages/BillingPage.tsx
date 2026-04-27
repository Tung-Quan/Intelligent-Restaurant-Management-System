import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Banknote, Smartphone, Split, TableProperties } from "lucide-react";

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
  table: {
    id: string;
    table_number: number;
  } | null;
  split_bill?: {
    mode: "even" | "items";
    shares: {
      party_name: string;
      total_amount: number;
    }[];
  } | null;
  items: { id: string; quantity: number; unit_price: number; menu_item_name: string }[];
}

interface BillingRecord {
  id: string;
  order_id: string;
  table_number: number | null;
  payment_method: string;
  amount_paid: number;
  subtotal: number;
  tax: number;
  discount: number;
  tip_amount: number;
  total_amount: number;
  promotion_code: string | null;
  paid_at: string;
  order: {
    id: string;
    items?: { id: string; quantity: number; unit_price: number; menu_item_name: string }[];
  } | null;
}

interface BillingRecordsResponse {
  records: BillingRecord[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

type OrderGroup = {
  key: string;
  label: string;
  tableId: string | null;
  tableNumber: number | null;
  totalAmount: number;
  orders: Order[];
};

export default function BillingPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [billingRecords, setBillingRecords] = useState<BillingRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [paymentOptions, setPaymentOptions] = useState<Record<string, { tip: string; promotionCode: string }>>({});
  const [processingTableKey, setProcessingTableKey] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const { toast } = useToast();

  const orderGroups = useMemo(() => {
    const groups = new Map<string, OrderGroup>();

    orders.forEach((order) => {
      const key = order.table?.id ?? order.table_id ?? "unassigned";
      const tableId = order.table?.id ?? order.table_id ?? null;
      const tableNumber = order.table?.table_number ?? null;
      const label = tableNumber === null ? "No table assigned" : `Table ${tableNumber}`;
      const existing = groups.get(key);

      if (existing) {
        existing.totalAmount += Number(order.total_amount);
        existing.orders.push(order);
        return;
      }

      groups.set(key, {
        key,
        label,
        tableId,
        tableNumber,
        totalAmount: Number(order.total_amount),
        orders: [order],
      });
    });

    return Array.from(groups.values()).sort((left, right) => {
      if (left.tableNumber === null && right.tableNumber === null) return left.label.localeCompare(right.label);
      if (left.tableNumber === null) return 1;
      if (right.tableNumber === null) return -1;
      return left.tableNumber - right.tableNumber;
    });
  }, [orders]);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.get<Order[]>("/billing/orders?status=ready,served,completed&include=items,items.menu_item");
      setOrders(data);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  const fetchBillingRecords = useCallback(async (page: number) => {
    setHistoryLoading(true);
    try {
      const data = await api.get<BillingRecordsResponse>(`/billing/records?page=${page}&limit=5`);
      setBillingRecords(data.records);
      setHistoryPage(data.page);
      setHistoryTotalPages(data.total_pages);
      setHistoryTotal(data.total);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    void fetchBillingRecords(1);
  }, [fetchOrders, fetchBillingRecords]);

  const getPaymentPayload = (order: Order, method: string) => {
    const options = paymentOptions[order.id] ?? { tip: "0", promotionCode: "" };
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

    return {
      method,
      amount: Number(payableAmount.toFixed(2)),
      tip_amount: Number(tipAmount.toFixed(2)),
      promotion_code: promotionCode || undefined,
    };
  };

  const payOrder = async (order: Order, method: string) => {
    await api.post(`/billing/orders/${order.id}/payments`, getPaymentPayload(order, method));
  };

  const processPayment = async (orderId: string, method: string) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order) return;

    await payOrder(order, method);
    if (order.table_id) {
      await api.patch(`/tables/${order.table_id}/status`, { status: "available" });
    }
    toast({ title: "Payment processed!" });
    await fetchOrders();
    await fetchBillingRecords(1);
  };

  const processTablePayment = async (group: OrderGroup) => {
    const unpaidOrders = group.orders.filter((order) => order.payment_status === "unpaid");
    if (unpaidOrders.length === 0 || processingTableKey) return;

    setProcessingTableKey(group.key);
    try {
      for (const order of unpaidOrders) {
        await payOrder(order, "cash");
      }

      if (group.tableId) {
        await api.patch(`/tables/${group.tableId}/status`, { status: "available" });
      }

      toast({
        title: "Table payment processed",
        description: `${group.label} paid in cash for ${unpaidOrders.length} order${unpaidOrders.length === 1 ? "" : "s"}.`,
      });
      await fetchOrders();
      await fetchBillingRecords(1);
    } catch (err) {
      toast({
        title: "Could not process table payment",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingTableKey(null);
    }
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
        {!initialLoading && orderGroups.map((group) => (
          <section key={group.key} className="animate-fade-in rounded-lg border bg-muted/20">
            <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <TableProperties className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-base font-bold">{group.label}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span>{group.orders.length} order{group.orders.length === 1 ? "" : "s"}</span>
                <span className="font-semibold text-foreground">Table total: ${group.totalAmount.toFixed(2)}</span>
                </div>
                <div>
                <Button
                  size="sm"
                  onClick={() => processTablePayment(group)}
                  disabled={!group.orders.some((order) => order.payment_status === "unpaid") || processingTableKey === group.key}
                >
                  <Banknote className="mr-1 h-3 w-3" />
                  {processingTableKey === group.key ? "Processing..." : "Pay table"}
                </Button>
              </div>
            </div>

            <div className="space-y-3 p-3">
              {group.orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
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
            </div>
          </section>
        ))}
        {!initialLoading && orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No unpaid orders ready for billing</div>
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-lg font-bold">Payment history</h2>
            <p className="text-sm text-muted-foreground">
              Paid bills are stored here after orders are marked paid.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{historyTotal} record{historyTotal === 1 ? "" : "s"}</p>
        </div>

        {historyLoading ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : billingRecords.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">No payment history yet</div>
        ) : (
          billingRecords.map((record) => (
            <Card key={record.id}>
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading font-bold">Order #{record.order_id.slice(0, 8)}</p>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {record.table_number === null ? "No table" : `Table ${record.table_number}`}
                    </span>
                    <StatusBadge status="paid" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paid at {new Date(record.paid_at).toLocaleString()} by {record.payment_method}
                  </p>
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {record.order?.items?.map((item) => (
                      <p key={item.id}>
                        {item.quantity}x {item.menu_item_name} — ${(item.quantity * Number(item.unit_price)).toFixed(2)}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="text-sm md:text-right">
                  <p>Subtotal: ${Number(record.subtotal).toFixed(2)}</p>
                  <p>Tax: ${Number(record.tax).toFixed(2)}</p>
                  {Number(record.discount) > 0 && <p>Discount: -${Number(record.discount).toFixed(2)}</p>}
                  {Number(record.tip_amount) > 0 && <p>Tip: ${Number(record.tip_amount).toFixed(2)}</p>}
                  {record.promotion_code && <p>Promotion: {record.promotion_code}</p>}
                  <p className="font-bold">Total: ${Number(record.total_amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Paid: ${Number(record.amount_paid).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {historyTotalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={historyPage <= 1 || historyLoading}
              onClick={() => fetchBillingRecords(historyPage - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {historyPage} of {historyTotalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={historyPage >= historyTotalPages || historyLoading}
              onClick={() => fetchBillingRecords(historyPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
