import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package, AlertTriangle } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_threshold: number;
  supplier: string | null;
  cost_per_unit: number;
  last_restocked_at: string | null;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", unit: "kg", quantity: "0", minThreshold: "10", supplier: "", costPerUnit: "0" });
  const { toast } = useToast();

  const fetchItems = async () => {
    const { data } = await supabase.from("inventory_items").select("*").order("name");
    if (data) setItems(data as any);
  };

  useEffect(() => { fetchItems(); }, []);

  const addItem = async () => {
    if (!form.name) { toast({ title: "Error", description: "Name required", variant: "destructive" }); return; }
    const { error } = await supabase.from("inventory_items").insert({
      name: form.name,
      unit: form.unit,
      quantity: parseFloat(form.quantity),
      min_threshold: parseFloat(form.minThreshold),
      supplier: form.supplier || null,
      cost_per_unit: parseFloat(form.costPerUnit),
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Item added!" });
    setDialogOpen(false);
    setForm({ name: "", unit: "kg", quantity: "0", minThreshold: "10", supplier: "", costPerUnit: "0" });
    fetchItems();
  };

  const updateQuantity = async (id: string, newQty: number) => {
    await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", id);
    fetchItems();
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track ingredients and supplies"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">Add Inventory Item</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Item name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Unit (kg, pcs...)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  <Input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Min threshold" value={form.minThreshold} onChange={(e) => setForm({ ...form, minThreshold: e.target.value })} />
                  <Input type="number" placeholder="Cost/unit" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
                </div>
                <Input placeholder="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
                <Button onClick={addItem} className="w-full">Add Item</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const isLow = Number(item.quantity) <= Number(item.min_threshold);
          return (
            <Card key={item.id} className="animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Package className={`h-4 w-4 ${isLow ? "text-warning" : "text-muted-foreground"}`} />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {isLow && <AlertTriangle className="h-4 w-4 text-warning" />}
                </div>
                <div className="mt-2 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Stock</span>
                    <span className={`font-semibold ${isLow ? "text-warning" : ""}`}>{Number(item.quantity)} {item.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min Level</span>
                    <span>{Number(item.min_threshold)} {item.unit}</span>
                  </div>
                  {item.supplier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supplier</span>
                      <span>{item.supplier}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, Number(item.quantity) - 1)}>-1</Button>
                  <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, Number(item.quantity) + 1)}>+1</Button>
                  <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, Number(item.quantity) + 10)}>+10</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">No inventory items yet</div>
        )}
      </div>
    </div>
  );
}
