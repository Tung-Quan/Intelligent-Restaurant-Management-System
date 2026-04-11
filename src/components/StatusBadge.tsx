import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  available: "bg-success/15 text-success",
  occupied: "bg-destructive/15 text-destructive",
  reserved: "bg-info/15 text-info",
  cleaning: "bg-warning/15 text-warning",
  pending: "bg-warning/15 text-warning",
  confirmed: "bg-info/15 text-info",
  seated: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-muted text-muted-foreground",
  in_progress: "bg-info/15 text-info",
  ready: "bg-success/15 text-success",
  served: "bg-success/15 text-success",
  preparing: "bg-warning/15 text-warning",
  cooking: "bg-primary/15 text-primary",
  paid: "bg-success/15 text-success",
  unpaid: "bg-destructive/15 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
      statusStyles[status] || "bg-muted text-muted-foreground"
    )}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
