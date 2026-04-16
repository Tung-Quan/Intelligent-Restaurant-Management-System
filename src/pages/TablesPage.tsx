import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { getReservationUrgency } from "@/lib/reservations";
import { Users, Sparkles, Clock3, CheckCircle2, Armchair } from "lucide-react";

interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  location_zone: string | null;
}

type RestaurantTableApi = RestaurantTable & {
  tableNumber?: number | string | null;
  table_number?: number | string | null;
  locationZone?: string | null;
};

interface Reservation {
  id: string;
  customer_name: string;
  party_size: number;
  reservation_time: string;
  status: string;
  table: { id: string; table_number: number } | null;
}

const TABLE_STATUSES = ["all", "available", "occupied", "reserved", "cleaning"] as const;
const TABLE_REFRESH_INTERVAL_MS = 30_000;

export default function TablesPage() {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [statusFilter, setStatusFilter] = useState<(typeof TABLE_STATUSES)[number]>("all");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [initialLoading, setInitialLoading] = useState(true);
  const { hasRole } = useAuth();

  const isHost = hasRole("host") && !hasRole("admin") && !hasRole("manager");

  const fetchTables = async () => {
    const data = await api.get<RestaurantTableApi[]>("/tables");
    setTables(
      data.map((table) => ({
        ...table,
        table_number: Number(table.table_number ?? table.tableNumber ?? 0),
        location_zone: table.location_zone ?? table.locationZone ?? "main",
      }))
    );
  };

  const fetchReservations = async () => {
    const data = await api.get<Reservation[]>("/reservations?sort=reservation_time");
    setReservations(data);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([fetchTables(), fetchReservations()]);
      } finally {
        setInitialLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!isHost) return;

    const interval = window.setInterval(() => {
      void Promise.all([fetchTables(), fetchReservations()]);
    }, TABLE_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isHost]);

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/tables/${id}/status`, { status });
    await fetchTables();
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

  const activeReservationsByTable = useMemo(() => {
    const next: Record<string, Reservation[]> = {};

    reservations
      .filter((reservation) => reservation.table && ["pending", "confirmed", "seated"].includes(reservation.status))
      .forEach((reservation) => {
        if (!reservation.table) return;
        next[reservation.table.id] = [...(next[reservation.table.id] || []), reservation];
      });

    return next;
  }, [reservations]);

  const hostMetrics = useMemo(
    () => ({
      arrivingSoon: reservations.filter((reservation) => {
        const urgency = getReservationUrgency(reservation);
        return reservation.table && (urgency === "late" || urgency === "imminent");
      }).length,
      readyToTurn: tables.filter((table) => table.status === "cleaning").length,
    }),
    [reservations, tables]
  );

  return (
    <div>
      <PageHeader
        title="Table Management"
        description={
          isHost
            ? "Host view: check current table availability and coordinate with restaurant staff"
            : "Monitor dining room status and update table availability in real time"
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-success/10 p-3 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Available now</p>
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{tableCounts.available}</p>}
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
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{tableCounts.reserved}</p>}
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
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{tableCounts.occupied}</p>}
            </div>
          </CardContent>
        </Card>
        {isHost && (
          <>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-xl bg-warning/10 p-3 text-warning">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Arrivals with table</p>
                  {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{hostMetrics.arrivingSoon}</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-xl bg-info/10 p-3 text-info">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Need reset</p>
                  {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{hostMetrics.readyToTurn}</p>}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as (typeof TABLE_STATUSES)[number])}>
          <TabsList>
            {TABLE_STATUSES.map((status) => (
              <TabsTrigger key={status} value={status} className="capitalize">
                {status}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Filter zone" />
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

      {initialLoading &&
        Array.from({ length: 2 }).map((_, zoneIndex) => (
          <div key={`table-zone-skeleton-${zoneIndex}`} className="mb-6">
            <Skeleton className="mb-3 h-7 w-36" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((__, cardIndex) => (
                <Card key={`table-skeleton-${zoneIndex}-${cardIndex}`} className="animate-fade-in">
                  <CardContent className="space-y-2 p-4 text-center">
                    <Skeleton className="mx-auto h-6 w-20" />
                    <Skeleton className="mx-auto h-4 w-16" />
                    <Skeleton className="mx-auto h-7 w-24 rounded-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

      {!initialLoading && zones.map((zone) => {
        const zoneTables = filteredTables.filter((table) => (table.location_zone || "main") === zone);
        if (zoneTables.length === 0) return null;

        return (
          <div key={zone} className="mb-6">
            <h2 className="mb-3 font-heading text-lg font-semibold capitalize">{zone} Area</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {zoneTables
                .slice()
                .sort((left, right) => left.table_number - right.table_number)
                .map((table) => (
                  <Card key={table.id} className="animate-fade-in">
                    <CardContent className="space-y-2 p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Armchair className="h-4 w-4 text-primary" />
                        <p className="font-heading text-lg font-bold">#{table.table_number || "?"}</p>
                      </div>
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" /> {table.capacity} seats
                      </div>
                      <StatusBadge status={table.status} />
                      {activeReservationsByTable[table.id]?.slice(0, 2).map((reservation) => (
                        <div key={reservation.id} className="rounded-lg bg-muted/70 px-2 py-1 text-[11px] text-left">
                          <p className="font-medium">{reservation.customer_name}</p>
                          <p className="text-muted-foreground">
                            {reservation.party_size} guests • {new Date(reservation.reservation_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ))}
                      {isHost ? (
                        <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                          View only. Ask restaurant staff to change this table in the system.
                        </div>
                      ) : (
                        <Select value={table.status} onValueChange={(value) => updateStatus(table.id, value)}>
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
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        );
      })}

      {!initialLoading && tables.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">No tables configured yet. Add tables from Admin.</div>
      )}
    </div>
  );
}
