import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Clock3, CheckCircle2, Sparkles, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type TableStatus = "available" | "occupied" | "reserved" | "cleaning";

interface RestaurantTable {
  id: string;
  table_number: string | number;
  capacity: number;
  status: TableStatus;
  location_zone: string | null;
}

type RestaurantTableApi = {
  id?: string;
  _id?: string;
  table_id?: string;
  tableId?: string;
  tableNumber?: number | string | null;
  table_number?: number | string | null;
  capacity?: number | string | null;
  status?: string | null;
  location_zone?: string | null;
  locationZone?: string | null;
};

interface Reservation {
  id: string;
  customer_name: string;
  party_size: number;
  reservation_time: string;
  status: string;
  table: { id: string; table_number: string | number } | null;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  is_available: boolean;
}

type MenuItemApi = {
  id?: string;
  _id?: string;
  menu_item_id?: string;
  menuItemId?: string;
  name: string;
  description?: string | null;
  price: number | string;
  is_available?: boolean;
  isAvailable?: boolean;
};

const TABLE_STATUSES = ["all", "available", "occupied", "reserved", "cleaning"] as const;
const TABLE_REFRESH_INTERVAL_MS = 30_000;

const TABLE_MUTATION_STATUSES: TableStatus[] = ["available", "occupied", "reserved", "cleaning"];

function isTableStatus(value: string): value is TableStatus {
  return TABLE_MUTATION_STATUSES.includes(value as TableStatus);
}

export default function TablesPage() {
  const { toast } = useToast();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [cartByItemId, setCartByItemId] = useState<Record<string, number>>({});
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof TABLE_STATUSES)[number]>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [initialLoading, setInitialLoading] = useState(true);
  const [updatingTableId, setUpdatingTableId] = useState<string | null>(null);
  const inFlightOrderKeyRef = useRef<string | null>(null);
  const { hasRole } = useAuth();

  const isHost = hasRole("host") && !hasRole("admin") && !hasRole("manager");
  const canPlaceOrders = hasRole("server") || hasRole("admin") || hasRole("manager");

  const fetchTables = async () => {
    const data = await api.get<RestaurantTableApi[]>("/tables");
    setTables(
      data.map((table) => {
        const nextStatus = typeof table.status === "string" && isTableStatus(table.status) ? table.status : "available";

        return {
          id: String(table.id || table.table_id || table.tableId || table._id || ""),
          table_number: table.table_number ?? table.tableNumber ?? "0",
          capacity: Number(table.capacity ?? 0),
          status: nextStatus,
          location_zone: table.location_zone ?? table.locationZone ?? "main",
        };
      })
    );
  };

  const fetchReservations = async () => {
    const data = await api.get<Reservation[]>("/reservations?sort=reservation_time");
    setReservations(data);
  };

  const fetchMenuItems = async () => {
    setMenuLoading(true);
    try {
      const data = await api.get<MenuItemApi[]>("/menu-items?is_available=true");
      setMenuItems(
        data
          .map((item) => ({
            id: String(item.id || item.menu_item_id || item.menuItemId || item._id || ""),
            name: item.name,
            description: item.description ?? null,
            price: Number(item.price),
            is_available: item.is_available ?? item.isAvailable ?? true,
          }))
          .filter((item) => item.is_available)
      );
    } finally {
      setMenuLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([fetchTables(), fetchReservations(), canPlaceOrders ? fetchMenuItems() : Promise.resolve()]);
      } finally {
        setInitialLoading(false);
      }
    };
    void load();
  }, [canPlaceOrders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void Promise.all([fetchTables(), fetchReservations()]);
    }, TABLE_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || null,
    [tables, selectedTableId]
  );

  const cartItems = useMemo(
    () =>
      menuItems
        .map((item) => ({
          item,
          quantity: cartByItemId[item.id] || 0,
        }))
        .filter((entry) => entry.quantity > 0),
    [menuItems, cartByItemId]
  );

  const cartSubtotal = useMemo(
    () => cartItems.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0),
    [cartItems]
  );

  const changeQuantity = (itemId: string, delta: number) => {
    setCartByItemId((prev) => {
      const nextQty = Math.max(0, (prev[itemId] || 0) + delta);
      if (nextQty === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: nextQty };
    });
  };

  const createOrderForChef = async () => {
    if (!canPlaceOrders) return;
    if (creatingOrder) {
      toast({ title: "Order is already being sent", description: "Please wait for the current request to finish." });
      return;
    }

    if (!selectedTable) {
      toast({ title: "Select a table", description: "Choose a table before sending order.", variant: "destructive" });
      return;
    }

    if (cartItems.length === 0) {
      toast({ title: "No dishes selected", description: "Use + to add dishes into the order.", variant: "destructive" });
      return;
    }

    const payload = {
      table_id: selectedTable.id,
      special_instructions: specialInstructions.trim() || undefined,
      order_type: "dine_in",
      items: cartItems.map((entry) => ({
        menu_item_id: entry.item.id,
        quantity: entry.quantity,
        unit_price: entry.item.price,
      })),
    };


    const payloadKey = JSON.stringify(payload);
    if (inFlightOrderKeyRef.current === payloadKey) {
      toast({ title: "Order is already being sent", description: "Please wait for the current request to finish." });
      return;
    }

    inFlightOrderKeyRef.current = payloadKey;
    setCreatingOrder(true);
    try {
      await api.post<{ id: string; status: string }>("/orders", payload);
      setCartByItemId({});
      setSpecialInstructions("");

      toast({
        title: "Order sent to chef",
        description: `Order for table ${selectedTable.table_number} created successfully.`,
      });

      if (selectedTable.status !== "occupied") {
        await updateStatus(selectedTable.id, "occupied");
      }
    } catch (err) {
      toast({
        title: "Order failed",
        description: err instanceof Error ? err.message : "Could not create order.",
        variant: "destructive",
      });
    } finally {
      inFlightOrderKeyRef.current = null;
      setCreatingOrder(false);
    }
  };

  const updateStatus = async (id: string, status: TableStatus) => {
    if (updatingTableId === id) return;

    const current = tables.find((table) => table.id === id);
    if (!current || current.status === status) return;

    setUpdatingTableId(id);
    try {
      await api.patch(`/tables/${id}/status`, { status });
      setTables((prev) => prev.map((table) => (table.id === id ? { ...table, status } : table)));
      toast({ title: "Table updated", description: `Table ${current.table_number} set to ${status}.` });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not update table status.",
        variant: "destructive",
      });
      await fetchTables();
    } finally {
      setUpdatingTableId(null);
    }
  };

  const zones = [...new Set(tables.map((table) => table.location_zone || "main"))];

  const filteredTables = useMemo(
    () =>
      tables.filter((table) => {
        const matchesStatus = statusFilter === "all" || table.status === statusFilter;
        const matchesZone = zoneFilter === "all" || (table.location_zone || "main") === zoneFilter;
        return matchesStatus && matchesZone;
      }),
    [statusFilter, tables, zoneFilter]
  );

  const tableCounts = useMemo(
    () => ({
      available: tables.filter((table) => table.status === "available").length,
      reserved: tables.filter((table) => table.status === "reserved").length,
      occupied: tables.filter((table) => table.status === "occupied").length,
    }),
    [tables]
  );

  const renderTableBlock = (table: RestaurantTable) => {
    const isOccupied = table.status === "occupied";
    const isAvailable = table.status === "available";
    const activeRes = reservations.find((reservation) => reservation.table?.id === table.id);

    let elapsedLabel = "";
    if (activeRes) {
      const diffMs = Date.now() - new Date(activeRes.reservation_time).getTime();
      const minutes = Math.max(0, Math.floor(diffMs / 60000));
      elapsedLabel = `${minutes}m`;
    }

    return (
      <div
        key={table.id}
        onClick={() => {
          setSelectedTableId(table.id);
        }}
        className={cn(
          "relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border shadow-sm transition-all duration-200 hover:scale-[1.02]",
          selectedTableId === table.id && "ring-2 ring-primary",
          updatingTableId === table.id && "pointer-events-none opacity-70",
          isOccupied
            ? "bg-[#00c838] text-white border-transparent"
            : isAvailable
              ? "bg-card text-card-foreground hover:bg-muted"
              : "bg-muted text-muted-foreground opacity-50"
        )}
      >
        {!isAvailable && (
          <span className="absolute top-2 text-[10px] font-semibold text-red-400">
            {elapsedLabel}
          </span>
        )}

        <span className="text-xl font-bold">{table.table_number}</span>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col gap-6 md:flex-row">
      <div className="flex-1 space-y-6">
        <PageHeader title="Table Map" description="Manage table status in real time" />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-success/10 p-3 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available now</p>
                {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="text-2xl font-bold">{tableCounts.available}</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-info/10 p-3 text-info">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reserved</p>
                {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="text-2xl font-bold">{tableCounts.reserved}</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Occupied</p>
                {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="text-2xl font-bold">{tableCounts.occupied}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Tabs
            value={statusFilter}
            onValueChange={(value) => {
              if (TABLE_STATUSES.includes(value as (typeof TABLE_STATUSES)[number])) {
                setStatusFilter(value as (typeof TABLE_STATUSES)[number]);
              }
            }}
          >
            <TabsList>
              {TABLE_STATUSES.map((status) => (
                <TabsTrigger key={status} value={status} className="capitalize">
                  {status}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select value={zoneFilter} onValueChange={setZoneFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone} className="capitalize">
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {initialLoading && (
          <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        )}

        {!initialLoading && zones.map((zone) => {
          const zoneTables = filteredTables.filter((table) => (table.location_zone || "main") === zone);
          if (zoneTables.length === 0) return null;

          return (
            <div key={zone} className="rounded-2xl bg-muted/30 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold capitalize">{zone}</h2>
              </div>

              <div className="grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
                {!isHost && (
                  <div
                    className="flex aspect-square cursor-not-allowed items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground"
                    title="Create table API is not available yet in current backend controller."
                  >
                    <Plus className="h-6 w-6" />
                  </div>
                )}

                {zoneTables
                  .slice()
                  .sort((a, b) => String(a.table_number).localeCompare(String(b.table_number)))
                  .map(renderTableBlock)}
              </div>
            </div>
          );
        })}

        {!initialLoading && tables.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">No tables have been configured yet.</div>
        )}
      </div>

      <div className="hidden w-full max-w-sm flex-col rounded-xl border bg-card p-4 shadow-sm md:flex">
        {!canPlaceOrders ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <p className="font-medium">Server order panel</p>
            <p className="mt-1 text-sm">Only server/manager/admin can create orders for chef.</p>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Selected table</p>
              <p className="text-base font-bold">
                {selectedTable ? `Table ${selectedTable.table_number}` : "Choose table from floor plan"}
              </p>
            </div>

            {selectedTable ? (
              <Select
                value={selectedTable.status}
                onValueChange={(value) => {
                  if (isTableStatus(value)) {
                    void updateStatus(selectedTable.id, value);
                  }
                }}
                disabled={updatingTableId === selectedTable.id}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Update table status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              <p className="text-sm font-semibold">Menu</p>
              {menuLoading ? (
                Array.from({ length: 6 }).map((_, idx) => <Skeleton key={idx} className="h-14 w-full rounded-md" />)
              ) : menuItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No available dishes.</p>
              ) : (
                menuItems.map((item) => {
                  const quantity = cartByItemId[item.id] || 0;
                  return (
                    <div key={item.id} className="rounded-md border p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium leading-5">{item.name}</p>
                          <p className="text-xs text-muted-foreground">${item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 px-0"
                            disabled={creatingOrder}
                            onClick={() => changeQuantity(item.id, -1)}
                          >
                            -
                          </Button>
                          <span className="w-6 text-center text-sm font-semibold">{quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 px-0"
                            disabled={creatingOrder}
                            onClick={() => changeQuantity(item.id, 1)}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-2 border-t pt-3">
              <Input
                placeholder="Special instructions for chef"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                disabled={creatingOrder}
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">${cartSubtotal.toFixed(2)}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => void createOrderForChef()}
                disabled={creatingOrder || !selectedTable || cartItems.length === 0}
              >
                {creatingOrder ? "Sending..." : "Send order to chef"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
