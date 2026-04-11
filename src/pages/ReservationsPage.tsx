import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, CalendarDays, Phone, Users } from "lucide-react";

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  party_size: number;
  reservation_time: string;
  status: string;
  notes: string | null;
  restaurant_tables: { table_number: number } | null;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", partySize: "2", date: "", time: "", notes: "" });
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchReservations = async () => {
    const { data } = await supabase
      .from("reservations")
      .select("*, restaurant_tables(table_number)")
      .order("reservation_time", { ascending: true });
    if (data) setReservations(data as any);
  };

  useEffect(() => { fetchReservations(); }, []);

  const createReservation = async () => {
    if (!form.name || !form.date || !form.time) {
      toast({ title: "Error", description: "Fill required fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("reservations").insert({
      customer_name: form.name,
      customer_phone: form.phone || null,
      party_size: parseInt(form.partySize),
      reservation_time: `${form.date}T${form.time}:00`,
      notes: form.notes || null,
      created_by: user?.id,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Reservation created!" });
    setDialogOpen(false);
    setForm({ name: "", phone: "", partySize: "2", date: "", time: "", notes: "" });
    fetchReservations();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("reservations").update({ status }).eq("id", id);
    fetchReservations();
  };

  return (
    <div>
      <PageHeader
        title="Reservations"
        description="Manage bookings and waitlist"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Reservation</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">New Reservation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Customer name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input type="number" placeholder="Party size" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} min={1} />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
                <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <Button onClick={createReservation} className="w-full">Create Reservation</Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-3">
        {reservations.map((r) => (
          <Card key={r.id} className="animate-fade-in">
            <CardContent className="flex items-center justify-between p-4">
              <div className="space-y-1">
                <p className="font-medium">{r.customer_name}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(r.reservation_time).toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.party_size} guests</span>
                  {r.customer_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.customer_phone}</span>}
                </div>
                {r.notes && <p className="text-xs text-muted-foreground">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending", "confirmed", "seated", "completed", "cancelled", "no_show"].map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
        {reservations.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No reservations yet</div>
        )}
      </div>
    </div>
  );
}
