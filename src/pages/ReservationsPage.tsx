import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, Sparkles, Clock, CheckCircle, 
  Search, Calendar, Phone, TableProperties, Edit3, ArrowRight
} from "lucide-react";

// --- Types ---
interface Reservation {
  id: string;
  customer_name: string;
  customer_phone?: string;
  party_size: number;
  reservation_time: string;
  status: string;
  notes?: string;
  table: { id: string; table_number: number; status?: string } | null;
}

interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

type RestaurantTableApi = {
  id: string;
  status: string;
  table_number?: number | string | null;
  tableNumber?: number | string | null;
  capacity?: number | string | null;
};

const RESERVATION_STATUSES = ["all", "pending", "confirmed", "seated", "completed", "cancelled"] as const;
const REFRESH_INTERVAL_MS = 30_000;

export default function ReservationsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("manager");

  // Admins and managers see the dashboard; other reservation roles see the booking form.
  if (!isAdmin) {
    return <HostBookingForm />;
  }

  return <AdminReservationsDashboard />;
}

// ==========================================
// 1. HOST VIEW: BOOKING FORM ONLY
// ==========================================
function HostBookingForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const lastSuccessfulPayloadKeyRef = useRef<string | null>(null);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [guests, setGuests] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");

  const fetchMyReservations = useCallback(async () => {
    if (!user) {
      setMyReservations([]);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const data = await api.get<Reservation[]>("/reservations?sort=reservation_time");
      const emailNeedle = user.email.toLowerCase();
      const nameNeedle = user.display_name.trim().toLowerCase();

      const ownedReservations = data
        .filter((reservation) => {
          const notes = (reservation.notes || "").toLowerCase();
          const customerName = reservation.customer_name.toLowerCase();
          return notes.includes(emailNeedle) || customerName === nameNeedle;
        })
        .sort(
          (left, right) =>
            new Date(right.reservation_time).getTime() - new Date(left.reservation_time).getTime()
        );

      setMyReservations(ownedReservations);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchMyReservations();
  }, [fetchMyReservations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    const partySize = Number(guests);

    if (!date || !time || !trimmedName || !Number.isInteger(partySize) || partySize < 1) {
      toast({
        title: "Invalid reservation form",
        description: "Please enter valid date, time, name, and guests (minimum 1).",
        variant: "destructive",
      });
      return;
    }

    const reservationDate = new Date(`${date}T${time}:00`);
    if (Number.isNaN(reservationDate.getTime())) {
      toast({
        title: "Invalid date/time",
        description: "Please choose a valid reservation date and time.",
        variant: "destructive",
      });
      return;
    }

    const noteParts: string[] = [];
    if (user?.email) noteParts.push(`Email: ${user.email}`);
    if (description.trim()) noteParts.push(description.trim());

    const payload = {
      customer_name: trimmedName,
      party_size: partySize,
      reservation_time: reservationDate.toISOString(),
      notes: noteParts.length ? noteParts.join("\n") : undefined,
    };
    const payloadKey = JSON.stringify(payload);
    if (lastSuccessfulPayloadKeyRef.current === payloadKey) {
      toast({
        title: "Already submitted",
        description: "This reservation request was already sent.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post<{ id: string; status: string }>("/reservations", payload);
      lastSuccessfulPayloadKeyRef.current = payloadKey;
      await fetchMyReservations();

      toast({
        title: "Reservation created",
        description: "Your booking request has been sent to admin.",
      });

      setDate("");
      setName("");
      setGuests("");
      setTime("");
      setDescription("");
    } catch (err) {
      toast({
        title: "Failed to create reservation",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8 relative">
      {/* Background decor */}
      <div className="text-center space-y-4 mb-10">
        <h1 className="text-3xl font-black uppercase tracking-wider">Table Reservation</h1>
        <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
          Please fill out the form below to request a reservation. Our admin team will review your request and assign a table for you shortly.
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">Date</label>
            <Input
              type="date"
              className="bg-muted/30 border-0 h-12"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Your Name */}
          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">Your Name</label>
            <div className="relative">
              <Input
                placeholder="Full name"
                className="bg-muted/30 border-0 h-12 pr-10"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
              <Edit3 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">Guests</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="Number of guests"
                className="bg-muted/30 border-0 h-12 pr-10"
                min={1}
                step={1}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                required
              />
              <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>

          {/* In Time */}
          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">In Time</label>
            <div className="relative">
              <Input
                type="time"
                className="bg-muted/30 border-0 h-12 pr-10"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
              <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-semibold ml-1">Description</label>
          <div className="relative">
            <Textarea 
              placeholder="Type here..." 
              className="bg-muted/30 border-0 min-h-[120px] resize-none pb-8"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
            <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">{description.length}/1000</span>
          </div>
        </div>

        <div className="flex justify-center pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#2D2D2D] hover:bg-black text-white rounded-full px-8 py-6 uppercase font-bold tracking-wider"
          >
            {isSubmitting ? "Sending..." : "Book a table"} <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </form>

      <div className="pt-4 space-y-3">
        <h2 className="text-lg font-bold tracking-tight">My reservation history</h2>
        {isHistoryLoading ? (
          <Card className="shadow-none border-muted">
            <CardContent className="p-4">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ) : myReservations.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-4 bg-muted/10">
            You do not have any reservations yet.
          </div>
        ) : (
          <div className="space-y-3">
            {myReservations.map((reservation) => {
              const reservationDate = new Date(reservation.reservation_time);
              let statusClass = "bg-gray-100 text-gray-700";
              if (reservation.status === "confirmed") statusClass = "bg-blue-50 text-blue-600";
              if (reservation.status === "seated") statusClass = "bg-green-50 text-green-600";
              if (reservation.status === "completed") statusClass = "bg-emerald-50 text-emerald-600";
              if (reservation.status === "cancelled") statusClass = "bg-red-50 text-red-600";
              if (reservation.status === "pending") statusClass = "bg-yellow-50 text-yellow-700";

              return (
                <Card key={reservation.id} className="shadow-none border border-muted-foreground/20 rounded-xl">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{reservation.customer_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass}`}>
                        {reservation.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {reservationDate.toLocaleString([], { dateStyle: "short", timeStyle: "short" })} • {reservation.party_size} guests
                    </p>
                    {reservation.table ? (
                      <p className="text-sm text-muted-foreground">Table {reservation.table.table_number}</p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. ADMIN VIEW: DASHBOARD AND TABLE ASSIGNMENT
// ==========================================
function AdminReservationsDashboard() {
  const { toast } = useToast();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof RESERVATION_STATUSES)[number]>("all");
  const [activeTab, setActiveTab] = useState("host-board");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutatingByReservation, setIsMutatingByReservation] = useState<Record<string, boolean>>({});
  const [selectedTableByReservation, setSelectedTableByReservation] = useState<Record<string, string>>({});
  const fetchVersionRef = useRef(0);

  const fetchData = async () => {
    const fetchVersion = ++fetchVersionRef.current;
    try {
      const [resData, tablesData] = await Promise.all([
        api.get<Reservation[]>("/reservations?sort=reservation_time"),
        api.get<RestaurantTableApi[]>("/tables")
      ]);
      if (fetchVersion !== fetchVersionRef.current) return;

      const normalizedTables: RestaurantTable[] = tablesData.map((table) => ({
        id: table.id,
        status: table.status,
        table_number: Number(table.table_number ?? table.tableNumber ?? 0),
        capacity: Number(table.capacity ?? 0),
      }));

      setReservations(resData);
      setTables(normalizedTables);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(() => fetchData(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  const setReservationMutating = (reservationId: string, isMutating: boolean) => {
    setIsMutatingByReservation((prev) => ({
      ...prev,
      [reservationId]: isMutating,
    }));
  };

  const handleStatusUpdate = async (reservation: Reservation, nextStatus: string) => {
    if (reservation.status === nextStatus || isMutatingByReservation[reservation.id]) return;

    setReservationMutating(reservation.id, true);
    try {
      const updated = await api.patch<{ id: string; status: string }>(`/reservations/${reservation.id}/status`, {
        status: nextStatus,
      });

      setReservations((prev) =>
        prev.map((entry) => (entry.id === updated.id ? { ...entry, status: updated.status } : entry))
      );

      toast({
        title: "Status updated",
        description: `Reservation moved to ${updated.status}.`,
      });
    } catch (err) {
      toast({
        title: "Could not update status",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setReservationMutating(reservation.id, false);
    }
  };

  const handleAssignAndConfirm = async (reservation: Reservation) => {
    if (reservation.table || isMutatingByReservation[reservation.id]) return;

    const selectedTableId = selectedTableByReservation[reservation.id];
    if (!selectedTableId) {
      toast({
        title: "Table is required",
        description: "Please select a table first.",
        variant: "destructive",
      });
      return;
    }

    const selectedTable = tables.find((table) => table.id === selectedTableId);
    if (!selectedTable || selectedTable.status !== "available") {
      toast({
        title: "Table unavailable",
        description: "Selected table is no longer available.",
        variant: "destructive",
      });
      return;
    }

    setReservationMutating(reservation.id, true);
    try {
      await api.patch(`/tables/${selectedTableId}/status`, { status: "reserved" });
      if (reservation.status !== "confirmed") {
        await api.patch(`/reservations/${reservation.id}/status`, { status: "confirmed" });
      }

      setTables((prev) =>
        prev.map((table) => (table.id === selectedTableId ? { ...table, status: "reserved" } : table))
      );
      setReservations((prev) =>
        prev.map((entry) =>
          entry.id === reservation.id
            ? {
                ...entry,
                status: "confirmed",
                table: {
                  id: selectedTable.id,
                  table_number: selectedTable.table_number,
                  status: "reserved",
                },
              }
            : entry
        )
      );

      toast({
        title: "Assigned successfully",
        description: `Table ${selectedTable.table_number} assigned and reservation confirmed.`,
      });
    } catch (err) {
      toast({
        title: "Assignment failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setReservationMutating(reservation.id, false);
    }
  };

  const metrics = useMemo(() => {
    const now = new Date().getTime();
    let arrivingSoon = 0; let needTableHold = 0; let readyToSeat = 0;
    reservations.forEach((res) => {
      const diffMins = (new Date(res.reservation_time).getTime() - now) / (1000 * 60);
      if (["pending", "confirmed"].includes(res.status)) {
        if (diffMins > -30 && diffMins <= 30) arrivingSoon++;
        if (!res.table) needTableHold++;
        if (res.table && res.table.status === "available") readyToSeat++;
      }
    });
    return { arrivingSoon, needTableHold, readyToSeat };
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      const matchesSearch = res.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (res.customer_phone && res.customer_phone.includes(searchQuery));
      const matchesStatus = statusFilter === "all" || res.status === statusFilter;
      const reservationDate = new Date(res.reservation_time);
      const now = new Date();
      const isToday = reservationDate.toDateString() === now.toDateString();
      const isUpcoming = reservationDate.getTime() > now.getTime();

      const matchesTab =
        activeTab === "host-board"
          ? ["pending", "confirmed"].includes(res.status)
          : activeTab === "today"
            ? isToday
            : isUpcoming;

      return matchesSearch && matchesStatus && matchesTab;
    });
  }, [reservations, searchQuery, statusFilter, activeTab]);

  const availableTables = useMemo(
    () => tables.filter((table) => table.status === "available").sort((a, b) => a.table_number - b.table_number),
    [tables]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Reservations Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Admin view: Review incoming booking requests, approve status, and assign tables.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Arriving soon" count={metrics.arrivingSoon} icon={<Clock className="w-5 h-5 text-yellow-600" />} />
        <MetricCard title="Need table assignment" count={metrics.needTableHold} icon={<Sparkles className="w-5 h-5 text-blue-500" />} />
        <MetricCard title="Ready to seat" count={metrics.readyToSeat} icon={<CheckCircle className="w-5 h-5 text-orange-500" />} />
      </div>

      <div className="flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full md:w-[280px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search guest or phone" className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (RESERVATION_STATUSES.includes(value as (typeof RESERVATION_STATUSES)[number])) {
              setStatusFilter(value as (typeof RESERVATION_STATUSES)[number]);
            }
          }}
        >
          <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            {RESERVATION_STATUSES.map(s => (<SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>))}
          </SelectContent>
        </Select>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="host-board">Pending Approvals</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (<Card key={`skel-${i}`} className="shadow-none border-muted"><CardContent className="p-6 h-32 flex items-center"><Skeleton className="h-full w-full" /></CardContent></Card>))
        ) : filteredReservations.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed">No reservations found.</div>
        ) : (
          filteredReservations.map((res) => {
            const resDate = new Date(res.reservation_time);
            
            // Choose the status badge color.
            let statusBadgeClass = "bg-gray-100 text-gray-700";
            if (res.status === "confirmed") statusBadgeClass = "bg-blue-50 text-blue-600";
            if (res.status === "pending") statusBadgeClass = "bg-yellow-50 text-yellow-600";

            return (
              <Card key={res.id} className="shadow-none border border-muted-foreground/20 rounded-xl overflow-hidden">
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-mono text-base font-semibold">{res.customer_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadgeClass}`}>
                        {res.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {resDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}</span>
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {res.party_size} guests</span>
                      <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {res.customer_phone || "N/A"}</span>
                    </div>

                    {res.notes && <p className="text-sm text-muted-foreground mt-1 border-l-2 pl-2 italic">{res.notes}</p>}
                  </div>

                  {/* Admin actions */}
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {!res.table ? (
                      <>
                        <Select
                          value={selectedTableByReservation[res.id] || ""}
                          onValueChange={(value) =>
                            setSelectedTableByReservation((prev) => ({
                              ...prev,
                              [res.id]: value,
                            }))
                          }
                          disabled={Boolean(isMutatingByReservation[res.id])}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Choose table" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTables.map((table) => (
                              <SelectItem key={table.id} value={table.id}>
                                Table {table.table_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(isMutatingByReservation[res.id]) || availableTables.length === 0}
                          onClick={() => void handleAssignAndConfirm(res)}
                          className="w-full text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
                        >
                          <TableProperties className="w-4 h-4 mr-2" />
                          {isMutatingByReservation[res.id] ? "Assigning..." : "Assign & Confirm"}
                        </Button>
                      </>
                    ) : (
                      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-md text-sm">
                        <span className="flex items-center gap-2"><TableProperties className="w-4 h-4" /> Table {res.table.table_number}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">Edit</Button>
                      </div>
                    )}
                    <Select
                      value={res.status}
                      onValueChange={(value) => void handleStatusUpdate(res, value)}
                      disabled={Boolean(isMutatingByReservation[res.id])}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Update Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="seated">Seated</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, count, icon }: { title: string, count: number, icon: React.ReactNode }) {
  return (
    <Card className="shadow-none border border-muted-foreground/20 rounded-xl">
      <CardContent className="flex items-start p-4 gap-3">
        <div className="rounded-md bg-muted/30 p-2 flex items-center justify-center">{icon}</div>
        <div className="flex flex-col">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1">{count}</p>
        </div>
      </CardContent>
    </Card>
  );
}
