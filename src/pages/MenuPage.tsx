import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCcw, Search, UtensilsCrossed } from "lucide-react";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  is_available: boolean;
  prep_time_minutes?: number | null;
  category_id?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("available");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  const fetchMenu = async () => {
    setRefreshing(true);
    try {
      const data = await api.get<MenuItem[]>("/menu-items?include=category");
      setMenuItems(data);
    } catch (error) {
      toast({
        title: "Unable to load menu",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    void fetchMenu();
  }, []);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          menuItems
            .map((item) => item.category?.name)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [menuItems]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);

      const matchesAvailability =
        availabilityFilter === "all" ||
        (availabilityFilter === "available" ? item.is_available : !item.is_available);

      const matchesCategory = categoryFilter === "all" || item.category?.name === categoryFilter;

      return matchesSearch && matchesAvailability && matchesCategory;
    });
  }, [availabilityFilter, categoryFilter, menuItems, search]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();

    filteredItems.forEach((item) => {
      const key = item.category?.name || "Uncategorized";
      groups.set(key, [...(groups.get(key) || []), item]);
    });

    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [filteredItems]);

  return (
    <div>
      <PageHeader
        title="Menu"
        description="Browse available dishes and current menu offerings"
        actions={
          <Button variant="outline" onClick={() => void fetchMenu()} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Menu items</p>
              {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{menuItems.length}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Available now</p>
            {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{menuItems.filter((item) => item.is_available).length}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Categories</p>
            {initialLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="font-heading text-2xl font-bold">{categories.length}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-[1fr_200px_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search dish or description" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Select value={availabilityFilter} onValueChange={(value) => setAvailabilityFilter(value as "all" | "available" | "unavailable")}>
          <SelectTrigger>
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="available">Available now</SelectItem>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="unavailable">Unavailable</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {initialLoading &&
          Array.from({ length: 2 }).map((_, sectionIndex) => (
            <section key={`menu-skeleton-section-${sectionIndex}`}>
              <Skeleton className="mb-3 h-7 w-40" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((__, cardIndex) => (
                  <Card key={`menu-skeleton-card-${sectionIndex}-${cardIndex}`} className="animate-fade-in">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-full space-y-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-3/4" />
                        </div>
                        <Skeleton className="h-6 w-24 rounded-full" />
                      </div>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between pt-0">
                      <div className="w-full space-y-2">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}

        {!initialLoading && groupedItems.map(([categoryName, items]) => (
          <section key={categoryName}>
            <h2 className="mb-3 font-heading text-lg font-semibold">{categoryName}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <Card key={item.id} className="animate-fade-in">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="font-heading text-base">{item.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description || "No description available."}</p>
                      </div>
                      <Badge variant={item.is_available ? "default" : "outline"}>
                        {item.is_available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between pt-0">
                    <div>
                      <p className="font-heading text-2xl font-bold">${Number(item.price).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        Prep time: {item.prep_time_minutes ?? 15} min
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {!initialLoading && groupedItems.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">No menu items match the current filters.</div>
        )}
      </div>
    </div>
  );
}
