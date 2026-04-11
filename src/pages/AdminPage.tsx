import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserCog, Shield, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ALL_ROLES: AppRole[] = ["admin", "manager", "server", "chef", "cashier", "host"];

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  manager: "bg-primary text-primary-foreground",
  server: "bg-accent text-accent-foreground",
  chef: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  cashier: "bg-green-500/20 text-green-700 dark:text-green-300",
  host: "bg-purple-500/20 text-purple-700 dark:text-purple-300",
};

interface StaffUser {
  user_id: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: AppRole[];
}

export default function AdminPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Category form
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [catOpen, setCatOpen] = useState(false);
  // Menu item form
  const [menuForm, setMenuForm] = useState({ name: "", description: "", price: "0", categoryId: "", prepTime: "15" });
  const [menuOpen, setMenuOpen] = useState(false);
  // Table form
  const [tableForm, setTableForm] = useState({ number: "", capacity: "4", zone: "main" });
  const [tableOpen, setTableOpen] = useState(false);

  const fetchAll = async () => {
    const [c, m, t, l] = await Promise.all([
      supabase.from("menu_categories").select("*").order("sort_order"),
      supabase.from("menu_items").select("*, menu_categories(name)").order("name"),
      supabase.from("restaurant_tables").select("*").order("table_number"),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (c.data) setCategories(c.data);
    if (m.data) setMenuItems(m.data);
    if (t.data) setTables(t.data);
    if (l.data) setLogs(l.data);
  };

  const fetchStaff = async () => {
    setStaffLoading(true);
    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, phone, avatar_url, created_at")
      .order("created_at");

    // Get all roles
    const { data: allRoles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (profiles) {
      const roleMap = new Map<string, AppRole[]>();
      allRoles?.forEach((r) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role as AppRole);
        roleMap.set(r.user_id, existing);
      });

      setStaff(
        profiles.map((p) => ({
          ...p,
          roles: roleMap.get(p.user_id) || [],
        }))
      );
    }
    setStaffLoading(false);
  };

  useEffect(() => {
    fetchAll();
    fetchStaff();
  }, []);

  const addCategory = async () => {
    if (!catForm.name) return;
    await supabase.from("menu_categories").insert({ name: catForm.name, description: catForm.description || null });
    toast({ title: "Category added!" });
    setCatOpen(false);
    setCatForm({ name: "", description: "" });
    fetchAll();
  };

  const addMenuItem = async () => {
    if (!menuForm.name) return;
    await supabase.from("menu_items").insert({
      name: menuForm.name,
      description: menuForm.description || null,
      price: parseFloat(menuForm.price),
      category_id: menuForm.categoryId || null,
      prep_time_minutes: parseInt(menuForm.prepTime),
    });
    toast({ title: "Menu item added!" });
    setMenuOpen(false);
    setMenuForm({ name: "", description: "", price: "0", categoryId: "", prepTime: "15" });
    fetchAll();
  };

  const addTable = async () => {
    if (!tableForm.number) return;
    await supabase.from("restaurant_tables").insert({
      table_number: parseInt(tableForm.number),
      capacity: parseInt(tableForm.capacity),
      location_zone: tableForm.zone,
    });
    toast({ title: "Table added!" });
    setTableOpen(false);
    setTableForm({ number: "", capacity: "4", zone: "main" });
    fetchAll();
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    await supabase.from("menu_items").update({ is_available: !current }).eq("id", id);
    fetchAll();
  };

  const assignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Role already assigned", variant: "destructive" });
      } else {
        toast({ title: "Error assigning role", description: error.message, variant: "destructive" });
      }
      return;
    }
    toast({ title: `Role "${role}" assigned successfully` });
    fetchStaff();
  };

  const removeRole = async (userId: string, role: AppRole) => {
    if (userId === currentUser?.id && role === "admin") {
      toast({ title: "Cannot remove your own admin role", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) {
      toast({ title: "Error removing role", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Role "${role}" removed` });
    fetchStaff();
  };

  return (
    <div>
      <PageHeader title="Admin" description="System configuration and management" />
      <Tabs defaultValue="menu" className="animate-fade-in">
        <TabsList>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-1.5">
            <UserCog className="h-3.5 w-3.5" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-4 mt-4">
          {/* Categories */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="font-heading text-base">Categories</CardTitle>
              <Dialog open={catOpen} onOpenChange={setCatOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
                    <Textarea placeholder="Description" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
                    <Button onClick={addCategory} className="w-full">Add</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {categories.map((c) => (
                  <div key={c.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.description}</span>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No categories</p>}
              </div>
            </CardContent>
          </Card>

          {/* Menu Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="font-heading text-base">Menu Items</CardTitle>
              <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Menu Item</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Name" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} />
                    <Textarea placeholder="Description" value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" placeholder="Price" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} />
                      <Input type="number" placeholder="Prep time (min)" value={menuForm.prepTime} onChange={(e) => setMenuForm({ ...menuForm, prepTime: e.target.value })} />
                    </div>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={menuForm.categoryId}
                      onChange={(e) => setMenuForm({ ...menuForm, categoryId: e.target.value })}
                    >
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Button onClick={addMenuItem} className="w-full">Add</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {menuItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted text-sm">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{item.menu_categories?.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">${Number(item.price).toFixed(2)}</span>
                      <Switch checked={item.is_available} onCheckedChange={() => toggleAvailability(item.id, item.is_available)} />
                    </div>
                  </div>
                ))}
                {menuItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No menu items</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="font-heading text-base">Restaurant Tables</CardTitle>
              <Dialog open={tableOpen} onOpenChange={setTableOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-3 w-3 mr-1" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Table</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input type="number" placeholder="Table number" value={tableForm.number} onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })} />
                    <Input type="number" placeholder="Capacity" value={tableForm.capacity} onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })} />
                    <Input placeholder="Zone (main, patio...)" value={tableForm.zone} onChange={(e) => setTableForm({ ...tableForm, zone: e.target.value })} />
                    <Button onClick={addTable} className="w-full">Add Table</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {tables.map((t) => (
                  <div key={t.id} className="p-3 rounded-lg border border-border text-center text-sm">
                    <p className="font-bold">#{t.table_number}</p>
                    <p className="text-xs text-muted-foreground">{t.capacity} seats • {t.location_zone}</p>
                  </div>
                ))}
              </div>
              {tables.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No tables configured</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Management Tab */}
        <TabsContent value="staff" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Staff & Role Management
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {staff.length} user{staff.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="pt-0">
              {staffLoading ? (
                <div className="text-sm text-muted-foreground text-center py-8 animate-pulse">Loading staff...</div>
              ) : staff.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
              ) : (
                <div className="space-y-3">
                  {staff.map((member) => (
                    <div
                      key={member.user_id}
                      className="rounded-xl border border-border p-4 space-y-3 hover:bg-muted/30 transition-colors"
                    >
                      {/* User info */}
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {member.display_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {member.display_name}
                            {member.user_id === currentUser?.id && (
                              <span className="text-xs text-muted-foreground ml-2">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Current roles */}
                      <div className="flex flex-wrap gap-1.5">
                        {member.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">No roles assigned</span>
                        )}
                        {member.roles.map((role) => (
                          <Badge
                            key={role}
                            className={`${ROLE_COLORS[role]} text-xs cursor-pointer hover:opacity-80 transition-opacity`}
                            onClick={() => removeRole(member.user_id, role)}
                            title={`Click to remove "${role}" role`}
                          >
                            {role === "admin" ? <ShieldAlert className="h-3 w-3 mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                            {role}
                            <span className="ml-1 opacity-60">×</span>
                          </Badge>
                        ))}
                      </div>

                      {/* Add role buttons */}
                      {ALL_ROLES.filter((r) => !member.roles.includes(r)).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-xs text-muted-foreground mr-1 self-center">Add:</span>
                          {ALL_ROLES.filter((r) => !member.roles.includes(r)).map((role) => (
                            <Button
                              key={role}
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => assignRole(member.user_id, role)}
                            >
                              + {role}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role Legend */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base">Role Permissions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-muted/50">
                  <span className="font-semibold">Admin</span> — Full system access, manage users & roles
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <span className="font-semibold">Manager</span> — Menu, inventory, tables, reports
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <span className="font-semibold">Server</span> — Create orders, manage tables, reservations
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <span className="font-semibold">Chef</span> — Kitchen display, update order item status
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <span className="font-semibold">Cashier</span> — Billing, payment processing
                </div>
                <div className="p-2 rounded-lg bg-muted/50">
                  <span className="font-semibold">Host</span> — Reservations, table assignments
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="font-heading text-base">Activity Logs</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {logs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-muted text-sm">
                    <div>
                      <span className="font-medium">{log.action}</span>
                      {log.entity_type && <span className="text-xs text-muted-foreground ml-2">({log.entity_type})</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No activity logs</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
