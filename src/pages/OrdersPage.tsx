import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Receipt, XCircle } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  is_available: boolean;
}

interface Table {
  id: string;
  table_number: number;
}

interface TableApi {
  id: string;
  table_number?: number | string | null;
  tableNumber?: number | string | null;
}

interface OrderSummary {
  id: string;
  status: string;
  total_amount: number;
  table_id: string | null;
  table?: {
    table_number?: number | string | null;
    tableNumber?: number | string | null;
  } | null;
  items: {
    id: string;
    menu_item_name: string;
    quantity: number;
  }[];
}

interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  notes: string;
}

export default function OrdersPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const [menuRes, tableRes, orderRes] = await Promise.all([
        api.get<MenuItem[]>("/menu-items?is_available=true"),
        api.get<TableApi[]>("/tables?sort=table_number"),
        // Added 'table' to the include parameter so we can see which table ordered
        api.get<OrderSummary[]>("/orders?include=items,items.menu_item,table&limit=20&sort=-created_at"),
      ]);

      const normalizedTables = tableRes.map((table) => ({
        id: table.id,
        table_number: Number(table.table_number ?? table.tableNumber ?? 0),
      }));

      setMenuItems(menuRes);
      setTables(normalizedTables);
      setOrders(orderRes);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useRealtimeSync(["orders.created.for_kds", "orders.status_updated"], () => {
    void fetchData();
  });

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) return prev.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, quantity: 1, price: item.price, notes: "" }];
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId));
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const getOrderTableNumber = (order: OrderSummary) => {
    const nestedTableNumber = order.table?.table_number ?? order.table?.tableNumber;
    if (nestedTableNumber !== undefined && nestedTableNumber !== null) {
      return Number(nestedTableNumber);
    }

    const matchingTable = tables.find((table) => table.id === order.table_id);
    return matchingTable?.table_number ?? null;
  };

  const submitOrder = async () => {
    if (!selectedTable || cart.length === 0) {
      toast({ title: "Error", description: "Select a table and add items", variant: "destructive" });
      return;
    }

    try {
      await api.post("/orders", {
        table_id: selectedTable,
        special_instructions: specialInstructions || null,
        items: cart.map((c) => ({
          menu_item_id: c.menuItemId,
          quantity: c.quantity,
          notes: c.notes || "",
        })),
      });

      // Mark table as occupied
      await api.patch(`/tables/${selectedTable}/status`, { status: "occupied" });

      toast({ title: "Order placed!" });
      setCart([]);
      setSelectedTable("");
      setSpecialInstructions("");
      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to place order",
        variant: "destructive",
      });
    }
  };

  const handleSendToBilling = async (orderId: string) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: "ready" });

      toast({ title: "Order sent to billing" });
      await fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send order to billing",
        variant: "destructive",
      });
    }
  };

  const handleCancelOrder = async (orderId: string, tableId: string | null) => {
    try {
      await api.patch(`/orders/${orderId}/cancel`);

      if (tableId) {
        await api.patch(`/tables/${tableId}/status`, { status: "available" });
      }

      toast({ title: "Order cancelled" });
      await fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel order",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Take and manage customer orders"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Order</Button>
            </DialogTrigger>
            {/* Removed max-h & overflow from DialogContent to prevent Select dropdown clipping */}
            <DialogContent className="max-w-2xl flex flex-col h-[85vh]">
              <DialogHeader>
                <DialogTitle className="font-heading">New Order</DialogTitle>
              </DialogHeader>
              
              {/* Added overflow-y-auto to this inner container instead */}
              <div className="space-y-4 flex-1 overflow-y-auto pr-4">
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
                  <SelectContent position="popper" className="z-[100]">
                    {tables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>Table {t.table_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div>
                  <h3 className="font-medium mb-2">Menu Items</h3>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {menuItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="flex justify-between items-center p-2 rounded-lg border border-border hover:bg-muted transition-colors text-left text-sm"
                      >
                        <span>{item.name}</span>
                        <span className="font-semibold text-primary">${item.price}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {cart.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-2">Cart</h3>
                    <div className="space-y-2">
                      {cart.map((c) => (
                        <div key={c.menuItemId} className="flex items-center justify-between p-2 rounded-lg bg-muted text-sm">
                          <span>{c.name} x{c.quantity}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">${(c.price * c.quantity).toFixed(2)}</span>
                            <Button variant="ghost" size="sm" onClick={() => removeFromCart(c.menuItemId)}>✕</Button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-2 border-t border-border">
                        <span>Total (+ 10% tax)</span>
                        <span>${(total * 1.1).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <Textarea
                  placeholder="Special instructions..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                />

                <Button onClick={submitOrder} className="w-full">
                  <Send className="h-4 w-4 mr-2" /> Place Order
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-3">
        {initialLoading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={`order-skeleton-${index}`} className="animate-fade-in">
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-72" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
          
        {!initialLoading && orders.map((order) => {
          const tableNumber = getOrderTableNumber(order);

          return (
            <Card key={order.id} className="animate-fade-in">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      Order #{order.id.slice(0, 8)}
                      {tableNumber !== null && (
                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-bold">
                          Table {tableNumber}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.items?.map((i) => `${i.menu_item_name} x${i.quantity}`).join(", ") || "No items"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-heading font-bold">${Number(order.total_amount).toFixed(2)}</span>
                  <StatusBadge status={order.status} />
                  
                  {order.status !== "completed" && order.status !== "cancelled" && order.status !== "ready" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleSendToBilling(order.id)}
                    >
                      <Receipt className="h-4 w-4 mr-2" />
                      Ready
                    </Button>
                  )}
                  {order.status !== "completed" && order.status !== "cancelled" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelOrder(order.id, order.table_id)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {!initialLoading && orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No orders yet. Create your first order!</div>
        )}
      </div>
    </div>
  );
}
