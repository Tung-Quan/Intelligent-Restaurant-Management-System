import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send } from "lucide-react";

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
  const [orders, setOrders] = useState<any[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const [menuRes, tableRes, orderRes] = await Promise.all([
        supabase.from("menu_items").select("*").eq("is_available", true),
        supabase.from("restaurant_tables").select("id, table_number").order("table_number"),
        supabase.from("orders").select("*, order_items(*, menu_items(name))").order("created_at", { ascending: false }).limit(20),
      ]);
      if (menuRes.data) setMenuItems(menuRes.data);
      if (tableRes.data) setTables(tableRes.data);
      if (orderRes.data) setOrders(orderRes.data);
    };
    fetchData();
  }, []);

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

  const submitOrder = async () => {
    if (!selectedTable || cart.length === 0) {
      toast({ title: "Error", description: "Select a table and add items", variant: "destructive" });
      return;
    }

    const { data: order, error } = await supabase.from("orders").insert({
      table_id: selectedTable,
      server_id: user?.id,
      special_instructions: specialInstructions || null,
      subtotal: total,
      tax: total * 0.1,
      total_amount: total * 1.1,
    }).select().single();

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    const items = cart.map((c) => ({
      order_id: order.id,
      menu_item_id: c.menuItemId,
      quantity: c.quantity,
      unit_price: c.price,
      notes: c.notes || null,
    }));

    await supabase.from("order_items").insert(items);
    await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", selectedTable);

    toast({ title: "Order placed!" });
    setCart([]);
    setSelectedTable("");
    setSpecialInstructions("");
    setDialogOpen(false);

    const { data } = await supabase.from("orders").select("*, order_items(*, menu_items(name))").order("created_at", { ascending: false }).limit(20);
    if (data) setOrders(data);
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
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">New Order</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
                  <SelectContent>
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
        {orders.map((order) => (
          <Card key={order.id} className="animate-fade-in">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-medium text-sm">Order #{order.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.order_items?.map((i: any) => `${i.menu_items?.name} x${i.quantity}`).join(", ") || "No items"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-heading font-bold">${Number(order.total_amount).toFixed(2)}</span>
                <StatusBadge status={order.status} />
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No orders yet. Create your first order!</div>
        )}
      </div>
    </div>
  );
}
