import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  location_zone: string | null;
}

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);

  const fetchTables = async () => {
    const { data } = await supabase.from("restaurant_tables").select("*").order("table_number");
    if (data) setTables(data);
  };

  useEffect(() => {
    fetchTables();
    const channel = supabase.channel("tables")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, fetchTables)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("restaurant_tables").update({ status }).eq("id", id);
    fetchTables();
  };

  const zones = [...new Set(tables.map((t) => t.location_zone || "main"))];

  return (
    <div>
      <PageHeader title="Table Management" description="Monitor and manage table status" />
      {zones.map((zone) => (
        <div key={zone} className="mb-6">
          <h2 className="font-heading text-lg font-semibold capitalize mb-3">{zone} Area</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {tables.filter((t) => (t.location_zone || "main") === zone).map((table) => (
              <Card key={table.id} className="animate-fade-in">
                <CardContent className="p-4 text-center space-y-2">
                  <p className="font-heading font-bold text-lg">#{table.table_number}</p>
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" /> {table.capacity} seats
                  </div>
                  <StatusBadge status={table.status} />
                  <Select value={table.status} onValueChange={(v) => updateStatus(table.id, v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="cleaning">Cleaning</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {tables.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">No tables configured yet. Add tables from Admin.</div>
      )}
    </div>
  );
}
