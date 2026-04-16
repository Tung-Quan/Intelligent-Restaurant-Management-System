import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  getHostBoardCounts,
  getMinutesUntilReservation,
  getReservationUrgency,
  sortReservationsForHost,
} from "@/lib/reservations";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  CalendarDays,
  Phone,
  Users,
  Armchair,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

const HOST_ASSIGNMENTS_STORAGE_KEY = "irms.host-table-assignments";
const HOST_REFRESH_INTERVAL_MS = 30_000;

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  party_size: number;
  reservation_time: string;
  status: string;
  notes: string | null;
  table: { id: string; table_number: number } | null;
}

interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  location_zone: string | null;
}

const RESERVATION_STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"];

type TableAssignmentMap = Record<string, RestaurantTable>;

function loadStoredAssignments() {
  try {
    const raw = localStorage.getItem(HOST_ASSIGNMENTS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TableAssignmentMap;
  } catch {
    return {};
  }
}

function formatTimingLabel(reservationTime: string) {
  const minutesUntil = getMinutesUntilReservation(reservationTime);

  if (minutesUntil < -15) return `${Math.abs(minutesUntil)} min overdue`;
  if (minutesUntil < 0) return "Arriving now";
  if (minutesUntil <= 60) return `In ${minutesUntil} min`;
  if (minutesUntil < 24 * 60) return `In ${Math.round(minutesUntil / 60)} hr`;
  return new Date(reservationTime).toLocaleString();
}

function urgencyBadgeClassName(urgency: ReturnType<typeof getReservationUrgency>) {
  switch (urgency) {
    case "late":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "imminent":
      return "border-warning/40 bg-warning/10 text-warning";
    case "soon":
      return "border-info/40 bg-info/10 text-info";
    case "upcoming":
      return "border-primary/40 bg-primary/10 text-primary";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [assignedTables, setAssignedTables] = useState<TableAssignmentMap>(() => loadStoredAssignments());
  const [selectedTables, setSelectedTables] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<"host_board" | "today" | "upcoming" | "history">("today");
  const [busyReservationId, setBusyReservationId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [form, setForm] = useState({ name: "", phone: "", partySize: "2", date: "", time: "", notes: "" });
  const { toast } = useToast();
  const { hasRole } = useAuth();

  const isHost = hasRole("host") && !hasRole("admin") && !hasRole("manager");

  useEffect(() => {
    localStorage.setItem(HOST_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(assignedTables));
  }, [assignedTables]);

  const fetchReservations = useCallback(async () => {
    const data = await api.get<Reservation[]>("/reservations?sort=reservation_time");
    setReservations(data);
  }, []);

  const fetchTables = useCallback(async () => {
    const data = await api.get<RestaurantTable[]>("/tables?sort=table_number");
    setTables(data);
  }, []);

  const refreshData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setRefreshing(true);

    try {
      await Promise.all([fetchReservations(), fetchTables()]);
    } catch (error) {
      toast({
        title: "Unable to refresh reservations",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      if (!silent) setRefreshing(false);
      setInitialLoading(false);
    }
  }, [fetchReservations, fetchTables, toast]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!isHost) return;

    const interval = window.setInterval(() => {
      refreshData({ silent: true });
    }, HOST_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isHost, refreshData]);

  useEffect(() => {
    if (isHost) {
      setServiceFilter((current) => (current === "today" ? "host_board" : current));
    }
  }, [isHost]);

  useEffect(() => {
    setAssignedTables((current) => {
      const next = { ...current };

      reservations.forEach((reservation) => {
        if (reservation.table) {
          const matchingTable = tables.find((table) => table.id === reservation.table?.id);
          next[reservation.id] =
            matchingTable ||
            next[reservation.id] || {
              id: reservation.table.id,
              table_number: reservation.table.table_number,
              capacity: reservation.party_size,
              status: reservation.status === "seated" ? "occupied" : "reserved",
              location_zone: null,
            };
        }

        if (["completed", "cancelled", "no_show"].includes(reservation.status)) {
          delete next[reservation.id];
        }
      });

      Object.keys(next).forEach((reservationId) => {
        if (!reservations.some((reservation) => reservation.id === reservationId)) {
          delete next[reservationId];
        }
      });

      return next;
    });
  }, [reservations, tables]);

  const setAssignedTable = useCallback((reservationId: string, table: RestaurantTable | null) => {
    setAssignedTables((current) => {
      const next = { ...current };

      if (table) {
        next[reservationId] = table;
      } else {
        delete next[reservationId];
      }

      return next;
    });
  }, []);

  const getEffectiveTable = useCallback(
    (reservation: Reservation) => {
      if (reservation.table) {
        return (
          tables.find((table) => table.id === reservation.table?.id) ||
          assignedTables[reservation.id] || {
            id: reservation.table.id,
            table_number: reservation.table.table_number,
            capacity: reservation.party_size,
            status: reservation.status === "seated" ? "occupied" : "reserved",
            location_zone: null,
          }
        );
      }

      return assignedTables[reservation.id] || null;
    },
    [assignedTables, tables]
  );

  const getEligibleTables = useCallback(
    (reservation: Reservation) => {
      const effectiveTable = getEffectiveTable(reservation);
      const selectedTableId = selectedTables[reservation.id];

      return tables
        .filter((table) => {
          if (table.capacity < reservation.party_size) return false;
          if (effectiveTable?.id === table.id) return true;
          if (selectedTableId === table.id) return true;
          return table.status === "available";
        })
        .sort((left, right) => {
          const capacityDiff = left.capacity - right.capacity;
          if (capacityDiff !== 0) return capacityDiff;
          return left.table_number - right.table_number;
        });
    },
    [getEffectiveTable, selectedTables, tables]
  );

  const resolveTableForReservation = useCallback(
    (reservation: Reservation) => {
      const selectedTableId = selectedTables[reservation.id];
      const effectiveTable = getEffectiveTable(reservation);
      const eligibleTables = getEligibleTables(reservation);

      if (selectedTableId) {
        const selected = eligibleTables.find((table) => table.id === selectedTableId);
        if (selected) return selected;
      }

      if (effectiveTable) return effectiveTable;

      return eligibleTables[0] || null;
    },
    [getEffectiveTable, getEligibleTables, selectedTables]
  );

  const createReservation = async () => {
    if (!form.name || !form.date || !form.time) {
      toast({ title: "Error", description: "Fill required fields", variant: "destructive" });
      return;
    }
    try {
      await api.post("/reservations", {
        customer_name: form.name,
        customer_phone: form.phone || null,
        party_size: parseInt(form.partySize, 10),
        reservation_time: `${form.date}T${form.time}:00`,
        notes: form.notes || null,
      });
      toast({ title: "Reservation created" });
      setDialogOpen(false);
      setForm({ name: "", phone: "", partySize: "2", date: "", time: "", notes: "" });
      await refreshData({ silent: true });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create reservation",
        variant: "destructive",
      });
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const reservation = reservations.find((item) => item.id === id);
    const effectiveTable = reservation ? getEffectiveTable(reservation) : null;

    setBusyReservationId(id);
    try {
      if (effectiveTable && ["completed", "cancelled", "no_show"].includes(status)) {
        await api.patch(`/tables/${effectiveTable.id}/status`, { status: "available" });
        setAssignedTable(id, null);
      }

      await api.patch(`/reservations/${id}/status`, { status });
      await refreshData({ silent: true });
    } catch (error) {
      toast({
        title: "Unable to update reservation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyReservationId(null);
    }
  };

  const reserveSuggestedTable = async (reservation: Reservation) => {
    const nextTable = resolveTableForReservation(reservation);
    if (!nextTable) {
      toast({
        title: "No table available",
        description: "All matching tables are occupied or too small right now.",
        variant: "destructive",
      });
      return;
    }

    setBusyReservationId(reservation.id);
    try {
      await api.patch(`/tables/${nextTable.id}/status`, { status: "reserved" });
      await api.patch(`/reservations/${reservation.id}/status`, { status: "confirmed" });
      setAssignedTable(reservation.id, nextTable);
      toast({
        title: `Held table #${nextTable.table_number}`,
        description: `${reservation.customer_name} is now confirmed.`,
      });
      await refreshData({ silent: true });
    } catch (error) {
      toast({
        title: "Unable to hold a table",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyReservationId(null);
    }
  };

  const seatReservation = async (reservation: Reservation) => {
    const nextTable = resolveTableForReservation(reservation);

    if (!nextTable) {
      toast({
        title: "No table ready",
        description: "Reserve or free up a suitable table before seating this party.",
        variant: "destructive",
      });
      return;
    }

    setBusyReservationId(reservation.id);
    try {
      await api.patch(`/tables/${nextTable.id}/status`, { status: "occupied" });
      await api.patch(`/reservations/${reservation.id}/status`, { status: "seated" });
      setAssignedTable(reservation.id, nextTable);
      toast({
        title: `${reservation.customer_name} seated`,
        description: `Moved to table #${nextTable.table_number}.`,
      });
      await refreshData({ silent: true });
    } catch (error) {
      toast({
        title: "Unable to seat guests",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyReservationId(null);
    }
  };

  const releaseTableForReservation = async (reservation: Reservation) => {
    const effectiveTable = getEffectiveTable(reservation);
    if (!effectiveTable?.id) return;

    setBusyReservationId(reservation.id);
    try {
      await api.patch(`/tables/${effectiveTable.id}/status`, { status: "available" });
      await api.patch(`/reservations/${reservation.id}/status`, { status: "completed" });
      setAssignedTable(reservation.id, null);
      toast({
        title: `${reservation.customer_name} completed`,
        description: `Table #${effectiveTable.table_number} is available again.`,
      });
      await refreshData({ silent: true });
    } catch (error) {
      toast({
        title: "Unable to complete seating",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyReservationId(null);
    }
  };

  const reservationCounts = useMemo(() => getHostBoardCounts(reservations), [reservations]);

  const availableTables = useMemo(
    () => tables.filter((table) => table.status === "available").sort((left, right) => left.table_number - right.table_number),
    [tables]
  );

  const filteredReservations = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();

    const nextReservations = reservations.filter((reservation) => {
      const reservationDate = new Date(reservation.reservation_time);
      const sameDay = reservationDate.toDateString() === now.toDateString();
      const inFuture = reservationDate >= now;
      const urgency = getReservationUrgency(reservation, now);
      const matchesService =
        serviceFilter === "host_board"
          ? urgency !== "history" && ["pending", "confirmed", "seated"].includes(reservation.status)
          : serviceFilter === "today"
            ? sameDay
            : serviceFilter === "upcoming"
              ? inFuture && !sameDay
              : reservationDate < now || ["completed", "cancelled", "no_show"].includes(reservation.status);

      const matchesStatus = statusFilter === "all" || reservation.status === statusFilter;
      const matchesSearch =
        !query ||
        reservation.customer_name.toLowerCase().includes(query) ||
        reservation.customer_phone?.toLowerCase().includes(query);

      return matchesService && matchesStatus && matchesSearch;
    });

    return isHost ? sortReservationsForHost(nextReservations, now) : nextReservations;
  }, [isHost, reservations, search, serviceFilter, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Reservations"
        description={
          isHost
            ? "Host view: create new reservations and review guest arrivals. Reservation changes must be handled by restaurant staff."
            : "Manage bookings, guest arrivals, and table coordination"
        }
        actions={
          <>
            <Button variant="outline" onClick={() => refreshData()} disabled={refreshing}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Reservation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading">New Reservation</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <Input
                    placeholder="Customer name *"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                  <Input
                    placeholder="Phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Party size"
                    value={form.partySize}
                    onChange={(event) => setForm({ ...form, partySize: event.target.value })}
                    min={1}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
                    <Input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} />
                  </div>
                  <Textarea
                    placeholder="Notes"
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                  <Button onClick={createReservation} className="w-full">
                    Create Reservation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-warning/10 p-3 text-warning">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Arriving soon</p>
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{reservationCounts.arrivingSoon}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-info/10 p-3 text-info">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Need table hold</p>
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{reservationCounts.needHold}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ready to seat</p>
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{reservationCounts.readyToSeat}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-success/10 p-3 text-success">
              <Armchair className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open tables now</p>
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{availableTables.length}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {isHost && (
        <Card className="mb-4 border-dashed border-border">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Hosts can create new reservations and check table availability only. To change reservation status, assigned table, or guest seating, send the details to restaurant staff so they can update the internal system.
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <Input
          className="lg:max-w-sm"
          placeholder="Search guest or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {RESERVATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={serviceFilter} onValueChange={(value) => setServiceFilter(value as "host_board" | "today" | "upcoming" | "history")}>
          <TabsList>
            {isHost && <TabsTrigger value="host_board">Host board</TabsTrigger>}
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-3">
        {initialLoading && (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`reservation-skeleton-${index}`} className="animate-fade-in">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-7 w-24 rounded-full" />
                        <Skeleton className="h-7 w-20 rounded-full" />
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-36" />
                      </div>
                      <Skeleton className="h-7 w-56 rounded-full" />
                      <Skeleton className="h-4 w-72" />
                    </div>
                    <div className="flex w-full max-w-sm flex-wrap items-center gap-2 xl:justify-end">
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {filteredReservations.map((reservation) => {
          const urgency = getReservationUrgency(reservation);
          const effectiveTable = getEffectiveTable(reservation);
          const eligibleTables = getEligibleTables(reservation);
          const suggestedTables = eligibleTables.slice(0, 3);
          const nextAction = isHost
            ? "Send updates to restaurant staff"
            : reservation.status === "pending"
              ? "Hold table"
              : reservation.status === "confirmed"
                ? "Seat guest"
                : reservation.status === "seated"
                  ? "Complete service"
                  : "Monitor";
          const isBusy = busyReservationId === reservation.id;

          return (
            <Card key={reservation.id} className="animate-fade-in">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{reservation.customer_name}</p>
                      <StatusBadge status={reservation.status} />
                      <Badge variant="outline" className={urgencyBadgeClassName(urgency)}>
                        {formatTimingLabel(reservation.reservation_time)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {new Date(reservation.reservation_time).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {reservation.party_size} guests
                      </span>
                      {reservation.customer_phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {reservation.customer_phone}
                        </span>
                      )}
                      {effectiveTable && (
                        <span className="flex items-center gap-1">
                          <Armchair className="h-3 w-3" />
                          Table #{effectiveTable.table_number}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline" className="bg-background">
                        Next: {nextAction}
                      </Badge>
                      {effectiveTable && (
                        <Badge variant="secondary" className="font-normal">
                          Assigned #{effectiveTable.table_number} • {effectiveTable.status}
                        </Badge>
                      )}
                    </div>
                    {suggestedTables.length > 0 && !effectiveTable && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Suggested tables:</span>
                        {suggestedTables.map((table) => (
                          <Badge key={table.id} variant="secondary" className="font-normal">
                            #{table.table_number} • {table.capacity} seats • {table.location_zone || "main"}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {reservation.notes && <p className="text-xs text-muted-foreground">{reservation.notes}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    {isHost ? (
                      <div className="max-w-sm rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                        To edit this reservation, send guest name, reservation time, and requested change to the restaurant team.
                      </div>
                    ) : (
                      <>
                        {eligibleTables.length > 0 && (
                          <Select
                            value={selectedTables[reservation.id] || effectiveTable?.id || ""}
                            onValueChange={(value) => setSelectedTables((current) => ({ ...current, [reservation.id]: value }))}
                            disabled={isBusy}
                          >
                            <SelectTrigger className="h-8 w-48 text-xs">
                              <SelectValue placeholder="Choose table" />
                            </SelectTrigger>
                            <SelectContent>
                              {eligibleTables.map((table) => (
                                <SelectItem key={table.id} value={table.id}>
                                  #{table.table_number} • {table.capacity} seats • {table.location_zone || "main"} • {table.status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        <Select value={reservation.status} onValueChange={(value) => updateStatus(reservation.id, value)} disabled={isBusy}>
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESERVATION_STATUSES.map((status) => (
                              <SelectItem key={status} value={status} className="capitalize">
                                {status.replace(/_/g, " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {reservation.status === "pending" && (
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => reserveSuggestedTable(reservation)}>
                            Hold Table
                          </Button>
                        )}

                        {["pending", "confirmed"].includes(reservation.status) && (
                          <Button size="sm" disabled={isBusy} onClick={() => seatReservation(reservation)}>
                            Seat Guest
                          </Button>
                        )}

                        {reservation.status === "seated" && effectiveTable && (
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => releaseTableForReservation(reservation)}>
                            Complete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {!initialLoading && filteredReservations.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">No reservations match the current filters</div>
        )}
      </div>
    </div>
  );
}
