import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, UtensilsCrossed, ChefHat, Armchair,
  CalendarDays, Receipt, Package, BarChart3, Settings, LogOut, BookOpen
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type AppRole = "admin" | "manager" | "server" | "chef" | "cashier" | "host";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles?: AppRole[]; // undefined = visible to all authenticated users
}

const navItems: NavItem[] = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/menu", icon: BookOpen, label: "Menu" },
  { to: "/orders", icon: UtensilsCrossed, label: "Orders", roles: ["admin", "manager", "server", "cashier"] },
  { to: "/kitchen", icon: ChefHat, label: "Kitchen (KDS)", roles: ["admin", "manager", "chef"] },
  { to: "/tables", icon: Armchair, label: "Tables", roles: ["admin", "manager", "server"] },
  { to: "/reservations", icon: CalendarDays, label: "Reservations", roles: ["admin", "manager", "server", "host"] },
  { to: "/billing", icon: Receipt, label: "Billing", roles: ["admin", "manager", "cashier"] },
  { to: "/inventory", icon: Package, label: "Inventory", roles: ["admin", "manager"] },
  { to: "/analytics", icon: BarChart3, label: "Analytics", roles: ["admin", "manager"] },
  { to: "/admin", icon: Settings, label: "Admin", roles: ["admin"] },
];

export function AppSidebar() {
  const { user, roles, signOut, hasRole } = useAuth();

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true;
    // If user has no roles at all, show everything (graceful fallback)
    if (roles.length === 0) return true;
    return item.roles.some((r) => hasRole(r));
  });

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
          <UtensilsCrossed className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="font-brand text-base font-bold text-sidebar-accent-foreground">IRMS</h1>
          <p className="font-heading text-xs text-sidebar-foreground/60">Restaurant Management</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "font-heading flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading text-xs font-medium text-sidebar-accent-foreground truncate">{user?.email}</p>
            {roles.length > 0 && (
              <p className="font-heading text-[10px] text-sidebar-foreground/50 truncate">
                {roles.join(", ")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={signOut}
          className="font-heading flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
