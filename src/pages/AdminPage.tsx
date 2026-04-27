import { useCallback, useEffect, useMemo, useState } from "react";
import { api, AppRole } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  UserCog,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  UtensilsCrossed,
  Armchair,
  ClipboardList,
  RefreshCcw,
  TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ALL_ROLES: AppRole[] = ["admin", "manager", "server", "chef", "cashier", "host"];

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  manager: "bg-primary text-primary-foreground",
  server: "bg-accent text-accent-foreground",
  chef: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  cashier: "bg-green-500/20 text-green-700 dark:text-green-300",
  host: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
};

interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  prep_time_minutes: number | null;
  category: { id: string; name: string } | null;
}

interface RestaurantTable {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
  location_zone: string | null;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  created_at: string;
}

interface StaffUser {
  user_id: string;
  display_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  roles: AppRole[];
}

const TABLE_STATUSES = ["available", "occupied", "reserved", "cleaning"];

export default function AdminPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [creatingAdminItem, setCreatingAdminItem] = useState<"category" | "menu" | "table" | null>(null);
  const [busyStaffUserId, setBusyStaffUserId] = useState<string | null>(null);
  const [busyMenuItemId, setBusyMenuItemId] = useState<string | null>(null);
  const [busyTableId, setBusyTableId] = useState<string | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffRoleFilter, setStaffRoleFilter] = useState<"all" | AppRole>("all");
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [catOpen, setCatOpen] = useState(false);

  const [menuForm, setMenuForm] = useState({
    name: "",
    description: "",
    price: "0",
    categoryId: "",
    prepTime: "15",
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const [tableForm, setTableForm] = useState({ number: "", capacity: "4", zone: "main" });
  const [tableOpen, setTableOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [c, m, t, l] = await Promise.all([
        api.get<MenuCategory[]>("/admin/menu-categories"),
        api.get<MenuItem[]>("/admin/menu-items?include=category"),
        api.get<RestaurantTable[]>("/admin/tables"),
        api.get<ActivityLog[]>("/admin/activity-logs?limit=50"),
      ]);
      setCategories(c);
      setMenuItems(m);
      setTables(t);
      setLogs(l);
    } catch (error) {
      toast({
        title: "Unable to load admin data",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const staffUsers = await api.get<StaffUser[]>("/admin/staff");
      setStaff(staffUsers);
    } catch (error) {
      toast({
        title: "Unable to load staff",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setStaffLoading(false);
    }
  }, [toast]);

  const refreshAdminData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchAll(), fetchStaff()]);
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [fetchAll, fetchStaff]);

  useEffect(() => {
    refreshAdminData();
  }, [refreshAdminData]);

  const addCategory = async () => {
    if (creatingAdminItem) {
      toast({ title: "Save in progress", description: "Please wait for the current admin change to finish." });
      return;
    }

    if (!catForm.name.trim()) {
      toast({ title: "Category name is required", variant: "destructive" });
      return;
    }

    setCreatingAdminItem("category");
    try {
      await api.post("/admin/menu-categories", {
        name: catForm.name.trim(),
        description: catForm.description.trim() || null,
      });
      toast({ title: "Category added" });
      setCatOpen(false);
      setCatForm({ name: "", description: "" });
      await fetchAll();
    } catch (error) {
      toast({
        title: "Unable to add category",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingAdminItem(null);
    }
  };

  const addMenuItem = async () => {
    if (creatingAdminItem) {
      toast({ title: "Save in progress", description: "Please wait for the current admin change to finish." });
      return;
    }

    const parsedPrice = parseFloat(menuForm.price);
    const parsedPrepTime = parseInt(menuForm.prepTime, 10);

    if (!menuForm.name.trim()) {
      toast({ title: "Menu item name is required", variant: "destructive" });
      return;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      toast({ title: "Price must be 0 or greater", variant: "destructive" });
      return;
    }

    if (Number.isNaN(parsedPrepTime) || parsedPrepTime < 0) {
      toast({ title: "Prep time must be 0 or greater", variant: "destructive" });
      return;
    }

    setCreatingAdminItem("menu");
    try {
      await api.post("/admin/menu-items", {
        name: menuForm.name.trim(),
        description: menuForm.description.trim() || null,
        price: parsedPrice,
        category_id: menuForm.categoryId || null,
        prep_time_minutes: parsedPrepTime,
      });
      toast({ title: "Menu item added" });
      setMenuOpen(false);
      setMenuForm({ name: "", description: "", price: "0", categoryId: "", prepTime: "15" });
      await fetchAll();
    } catch (error) {
      toast({
        title: "Unable to add menu item",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingAdminItem(null);
    }
  };

  const addTable = async () => {
    if (creatingAdminItem) {
      toast({ title: "Save in progress", description: "Please wait for the current admin change to finish." });
      return;
    }

    const tableNumber = parseInt(tableForm.number, 10);
    const capacity = parseInt(tableForm.capacity, 10);

    if (Number.isNaN(tableNumber) || tableNumber <= 0) {
      toast({ title: "Table number must be greater than 0", variant: "destructive" });
      return;
    }

    if (Number.isNaN(capacity) || capacity <= 0) {
      toast({ title: "Capacity must be greater than 0", variant: "destructive" });
      return;
    }

    setCreatingAdminItem("table");
    try {
      await api.post("/admin/tables", {
        table_number: tableNumber,
        capacity,
        location_zone: tableForm.zone.trim() || "main",
      });
      toast({ title: "Table added" });
      setTableOpen(false);
      setTableForm({ number: "", capacity: "4", zone: "main" });
      await fetchAll();
    } catch (error) {
      toast({
        title: "Unable to add table",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreatingAdminItem(null);
    }
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    if (busyMenuItemId) return;

    setBusyMenuItemId(id);
    try {
      await api.patch(`/admin/menu-items/${id}/availability`, { is_available: !current });
      await fetchAll();
    } catch (error) {
      toast({
        title: "Unable to update menu availability",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyMenuItemId(null);
    }
  };

  const updateTableStatus = async (id: string, status: string) => {
    if (busyTableId) return;

    setBusyTableId(id);
    try {
      await api.patch(`/tables/${id}/status`, { status });
      await fetchAll();
    } catch (error) {
      toast({
        title: "Unable to update table status",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusyTableId(null);
    }
  };

  const assignRole = async (userId: string, role: AppRole) => {
    if (busyStaffUserId) {
      toast({ title: "Role update in progress", description: "Please wait for the current role change to finish." });
      return;
    }

    setBusyStaffUserId(userId);
    try {
      await api.post(`/admin/staff/${userId}/roles`, { role });
      toast({ title: `Assigned "${role}"` });
      await fetchStaff();
    } catch (error) {
      toast({
        title: "Error assigning role",
        description: error instanceof Error ? error.message : "Failed to assign role",
        variant: "destructive",
      });
    } finally {
      setBusyStaffUserId(null);
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    if (busyStaffUserId) {
      toast({ title: "Role update in progress", description: "Please wait for the current role change to finish." });
      return;
    }

    if (userId === currentUser?.id && role === "admin") {
      toast({ title: "You cannot remove your own admin role", variant: "destructive" });
      return;
    }

    const adminCount = staff.filter((member) => member.roles.includes("admin")).length;
    if (role === "admin" && adminCount <= 1) {
      toast({ title: "At least one admin is required", variant: "destructive" });
      return;
    }

    setBusyStaffUserId(userId);
    try {
      await api.delete(`/admin/staff/${userId}/roles/${role}`);
      toast({ title: `Removed "${role}"` });
      await fetchStaff();
    } catch (error) {
      toast({
        title: "Error removing role",
        description: error instanceof Error ? error.message : "Failed to remove role",
        variant: "destructive",
      });
    } finally {
      setBusyStaffUserId(null);
    }
  };

  const tableStatusCounts = useMemo(
    () =>
      TABLE_STATUSES.map((status) => ({
        status,
        total: tables.filter((table) => table.status === status).length,
      })),
    [tables]
  );

  const roleDistribution = useMemo(
    () =>
      ALL_ROLES.map((role) => ({
        role,
        total: staff.filter((member) => member.roles.includes(role)).length,
      })),
    [staff]
  );

  const filteredStaff = useMemo(() => {
    const search = staffSearch.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesSearch =
        !search ||
        member.display_name.toLowerCase().includes(search) ||
        member.phone?.toLowerCase().includes(search);
      const matchesRole = staffRoleFilter === "all" || member.roles.includes(staffRoleFilter);
      return matchesSearch && matchesRole;
    });
  }, [staff, staffRoleFilter, staffSearch]);

  const adminCount = roleDistribution.find((item) => item.role === "admin")?.total || 0;
  const missingRoleCoverage = roleDistribution.filter((item) => item.total === 0).map((item) => item.role);
  const unassignedStaffCount = staff.filter((member) => member.roles.length === 0).length;
  const unavailableMenuCount = menuItems.filter((item) => !item.is_available).length;
  const tablesNeedingAttention = tables.filter((table) => table.status === "reserved" || table.status === "cleaning").length;
  const setupAlerts = [
    unassignedStaffCount > 0 ? `${unassignedStaffCount} staff member${unassignedStaffCount > 1 ? "s" : ""} still need role assignment` : null,
    adminCount === 1 ? "Only one admin is assigned right now" : null,
    missingRoleCoverage.length > 0 ? `No active coverage for ${missingRoleCoverage.join(", ")}` : null,
    unavailableMenuCount > 0 ? `${unavailableMenuCount} menu item${unavailableMenuCount > 1 ? "s are" : " is"} unavailable` : null,
    tablesNeedingAttention > 0 ? `${tablesNeedingAttention} table${tablesNeedingAttention > 1 ? "s need" : " needs"} follow-up` : null,
  ].filter(Boolean) as string[];

  const overviewCards = [
    {
      label: "Staff members",
      value: staff.length,
      helper: `${adminCount} admins active`,
      icon: Users,
    },
    {
      label: "Menu items",
      value: menuItems.length,
      helper: `${menuItems.filter((item) => item.is_available).length} available right now`,
      icon: UtensilsCrossed,
    },
    {
      label: "Tables configured",
      value: tables.length,
      helper: `${tableStatusCounts.find((item) => item.status === "available")?.total || 0} available`,
      icon: Armchair,
    },
    {
      label: "Setup alerts",
      value: setupAlerts.length,
      helper: setupAlerts[0] || "Everything critical is assigned",
      icon: ClipboardList,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Admin"
        description="Control restaurant configuration, staff access, and operating readiness"
        actions={
          <Button variant="outline" onClick={refreshAdminData} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="animate-fade-in">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-1.5">
            <UserCog className="h-3.5 w-3.5" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="flex items-start justify-between p-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    {initialLoading ? <Skeleton className="h-9 w-16" /> : <p className="font-heading text-3xl font-bold">{card.value}</p>}
                    {initialLoading ? <Skeleton className="h-4 w-full" /> : <p className="text-xs text-muted-foreground">{card.helper}</p>}
                  </div>
                  <div className="rounded-xl bg-primary/10 p-3 text-primary">
                    <card.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base">Role distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(initialLoading ? ALL_ROLES.map((role) => ({ role, total: 0 })) : roleDistribution).map(({ role, total }) => (
                  <div key={role} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Badge className={ROLE_COLORS[role]}>{role}</Badge>
                    </div>
                    {initialLoading ? <Skeleton className="h-4 w-6" /> : <span className="text-sm font-semibold">{total}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-heading text-base">Admin watchlist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {initialLoading ? (
                  Array.from({ length: 3 }).map((_, index) => <Skeleton key={`alert-skeleton-${index}`} className="h-10 w-full" />)
                ) : setupAlerts.length === 0 ? (
                  <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                    No critical setup issues detected.
                  </div>
                ) : (
                  setupAlerts.map((alert) => (
                    <div key={alert} className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
                      <TriangleAlert className="mt-0.5 h-4 w-4 text-warning" />
                      <span>{alert}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="font-heading text-base">Categories</CardTitle>
              <Dialog open={catOpen} onOpenChange={setCatOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Category</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      placeholder="Name"
                      value={catForm.name}
                      onChange={(event) => setCatForm({ ...catForm, name: event.target.value })}
                    />
                    <Textarea
                      placeholder="Description"
                      value={catForm.description}
                      onChange={(event) => setCatForm({ ...catForm, description: event.target.value })}
                    />
                    <Button onClick={addCategory} className="w-full" disabled={creatingAdminItem !== null}>
                      {creatingAdminItem === "category" ? "Adding..." : "Add"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {initialLoading &&
                  Array.from({ length: 4 }).map((_, index) => <Skeleton key={`category-skeleton-${index}`} className="h-10 w-full" />)}
                {!initialLoading && categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-lg p-2 text-sm hover:bg-muted">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">{category.description}</span>
                  </div>
                ))}
                {!initialLoading && categories.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No categories yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="font-heading text-base">Menu Items</CardTitle>
              <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Menu Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      placeholder="Name"
                      value={menuForm.name}
                      onChange={(event) => setMenuForm({ ...menuForm, name: event.target.value })}
                    />
                    <Textarea
                      placeholder="Description"
                      value={menuForm.description}
                      onChange={(event) => setMenuForm({ ...menuForm, description: event.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Price"
                        value={menuForm.price}
                        onChange={(event) => setMenuForm({ ...menuForm, price: event.target.value })}
                      />
                      <Input
                        type="number"
                        placeholder="Prep time (min)"
                        value={menuForm.prepTime}
                        onChange={(event) => setMenuForm({ ...menuForm, prepTime: event.target.value })}
                      />
                    </div>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={menuForm.categoryId}
                      onChange={(event) => setMenuForm({ ...menuForm, categoryId: event.target.value })}
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <Button onClick={addMenuItem} className="w-full" disabled={creatingAdminItem !== null}>
                      {creatingAdminItem === "menu" ? "Adding..." : "Add"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {initialLoading &&
                  Array.from({ length: 5 }).map((_, index) => <Skeleton key={`menu-item-skeleton-${index}`} className="h-10 w-full" />)}
                {!initialLoading && menuItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg p-2 text-sm hover:bg-muted">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.category?.name || "Uncategorized"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{item.prep_time_minutes || 0} min</span>
                      <span className="font-semibold">${Number(item.price).toFixed(2)}</span>
                      <Switch
                        checked={item.is_available}
                        disabled={busyMenuItemId === item.id}
                        onCheckedChange={() => toggleAvailability(item.id, item.is_available)}
                      />
                    </div>
                  </div>
                ))}
                {!initialLoading && menuItems.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No menu items yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {tableStatusCounts.map(({ status, total }) => (
              <Card key={status}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground capitalize">{status}</p>
                  {initialLoading ? <Skeleton className="mt-2 h-8 w-12" /> : <p className="mt-1 font-heading text-2xl font-bold">{total}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="font-heading text-base">Restaurant Tables</CardTitle>
              <Dialog open={tableOpen} onOpenChange={setTableOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Table</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      type="number"
                      placeholder="Table number"
                      value={tableForm.number}
                      onChange={(event) => setTableForm({ ...tableForm, number: event.target.value })}
                    />
                    <Input
                      type="number"
                      placeholder="Capacity"
                      value={tableForm.capacity}
                      onChange={(event) => setTableForm({ ...tableForm, capacity: event.target.value })}
                    />
                    <Input
                      placeholder="Zone (main, patio...)"
                      value={tableForm.zone}
                      onChange={(event) => setTableForm({ ...tableForm, zone: event.target.value })}
                    />
                    <Button onClick={addTable} className="w-full" disabled={creatingAdminItem !== null}>
                      {creatingAdminItem === "table" ? "Adding..." : "Add Table"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {initialLoading &&
                  Array.from({ length: 4 }).map((_, index) => <Skeleton key={`table-card-skeleton-${index}`} className="h-28 w-full" />)}
                {!initialLoading && tables
                  .slice()
                  .sort((left, right) => left.table_number - right.table_number)
                  .map((table) => (
                    <div key={table.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold">#{table.table_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {table.capacity} seats • {table.location_zone || "main"}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {table.status}
                        </Badge>
                      </div>
                      <Select value={table.status} onValueChange={(value) => updateTableStatus(table.id, value)} disabled={busyTableId === table.id}>
                        <SelectTrigger className="mt-3 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TABLE_STATUSES.map((status) => (
                            <SelectItem key={status} value={status} className="capitalize">
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
              </div>
              {!initialLoading && tables.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No tables configured</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 font-heading text-base">
                <Shield className="h-4 w-4" />
                Staff & Role Management
              </CardTitle>
              <Badge variant="outline" className="w-fit text-xs">
                {staff.length} user{staff.length !== 1 ? "s" : ""}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-3 md:grid-cols-[1fr_200px]">
                <Input
                  placeholder="Search by name or phone"
                  value={staffSearch}
                  onChange={(event) => setStaffSearch(event.target.value)}
                />
                <Select value={staffRoleFilter} onValueChange={(value) => setStaffRoleFilter(value as "all" | AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {ALL_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {initialLoading || staffLoading ? (
                <div className="animate-pulse py-8 text-center text-sm text-muted-foreground">Loading staff...</div>
              ) : filteredStaff.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No matching users found</p>
              ) : (
                <div className="space-y-3">
                  {filteredStaff.map((member) => (
                    <div
                      key={member.user_id}
                      className="space-y-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {member.display_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {member.display_name}
                            {member.user_id === currentUser?.id && (
                              <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.created_at).toLocaleDateString()}
                            {member.phone ? ` • ${member.phone}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {member.roles.length === 0 && (
                          <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                            No roles assigned
                          </Badge>
                        )}
                        {member.roles.map((role) => (
                          <Badge
                            key={role}
                            className={`${ROLE_COLORS[role]} cursor-pointer text-xs transition-opacity hover:opacity-80`}
                            aria-disabled={busyStaffUserId === member.user_id}
                            onClick={() => {
                              if (busyStaffUserId === null) {
                                removeRole(member.user_id, role);
                              }
                            }}
                            title={`Click to remove "${role}" role`}
                          >
                            {role === "admin" ? <ShieldAlert className="mr-1 h-3 w-3" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
                            {role}
                            <span className="ml-1 opacity-60">x</span>
                          </Badge>
                        ))}
                      </div>

                      {ALL_ROLES.filter((role) => !member.roles.includes(role)).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="mr-1 self-center text-xs text-muted-foreground">Add:</span>
                          {ALL_ROLES.filter((role) => !member.roles.includes(role)).map((role) => (
                            <Button
                              key={role}
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              disabled={busyStaffUserId === member.user_id}
                              onClick={() => assignRole(member.user_id, role)}
                            >
                              + {role}
                            </Button>
                          ))}
                        </div>
                      )}

                      {member.roles.includes("admin") && adminCount === 1 && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
                          This account is the last remaining admin. Keep at least one admin assigned at all times.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="font-heading text-base">Role permissions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 pt-0 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-2 text-xs">
                <span className="font-semibold">Admin</span> - full system access, user roles, setup, visibility
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-xs">
                <span className="font-semibold">Manager</span> - menu, inventory, tables, reports
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-xs">
                <span className="font-semibold">Server</span> - create orders, manage tables, reservations
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-xs">
                <span className="font-semibold">Chef</span> - kitchen display, item preparation flow
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-xs">
                <span className="font-semibold">Cashier</span> - billing, payment processing
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-xs">
                <span className="font-semibold">Host</span> - reservations, check-in, table coordination
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-base">Activity Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {initialLoading &&
                  Array.from({ length: 6 }).map((_, index) => <Skeleton key={`log-skeleton-${index}`} className="h-10 w-full" />)}
                {!initialLoading && logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-lg p-2 text-sm hover:bg-muted">
                    <div>
                      <span className="font-medium">{log.action}</span>
                      {log.entity_type && <span className="ml-2 text-xs text-muted-foreground">({log.entity_type})</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                ))}
                {!initialLoading && logs.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No activity logs</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
