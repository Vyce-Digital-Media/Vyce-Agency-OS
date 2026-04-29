import { useEffect, useState, useMemo, useCallback } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Search, X, SlidersHorizontal } from "lucide-react";
import DeliverableDetailSheet, { DeliverableForSheet } from "@/components/DeliverableDetailSheet";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  priority: string;
  plan_id: string;
  description: string | null;
  approved_by: string | null;
  approved_at: string | null;
  monthly_plans: {
    month: number;
    year: number;
    client_id: string;
    clients: { name: string; brand_color: string } | null;
  } | null;
}

interface Profile { user_id: string; full_name: string; internal_label: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", in_review: "In Review",
  needs_approval: "Needs Approval", approved: "Approved", delivered: "Delivered",
};

const STATUS_CHIP: Record<string, string> = {
  not_started:   "border-l-muted-foreground/40 bg-muted/40",
  in_progress:   "border-l-primary bg-primary/5",
  in_review:     "border-l-yellow-500 bg-yellow-500/5",
  needs_approval:"border-l-orange-500 bg-orange-500/5",
  approved:      "border-l-green-500 bg-green-500/5",
  delivered:     "border-l-accent bg-accent/5",
};

const STATUS_DOT: Record<string, string> = {
  not_started:   "bg-muted-foreground/40",
  in_progress:   "bg-primary",
  in_review:     "bg-yellow-500",
  needs_approval:"bg-orange-500",
  approved:      "bg-green-500",
  delivered:     "bg-accent",
};

const TYPE_LABELS: Record<string, string> = {
  post:"Post", reel:"Reel", story:"Story", ad:"Ad",
  campaign:"Campaign", blog:"Blog", newsletter:"Newsletter", other:"Other",
};

const PRIORITY_BADGE: Record<string, string> = {
  low:    "bg-green-500/10 text-green-700 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  high:   "bg-red-500/10 text-red-700 border-red-500/20",
  urgent: "bg-purple-500/10 text-purple-700 border-purple-500/20",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Calendar() {
  const { role, user } = useAuth();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Day popover
  const [openDay, setOpenDay] = useState<number | null>(null);

  // Detail sheet
  const [selectedDeliverable, setSelectedDeliverable] = useState<DeliverableForSheet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Client-role: their linked client_id
  const [myClientId, setMyClientId] = useState<string | null>(null);
  const [clientResolved, setClientResolved] = useState(false);

  const isAdmin = role === "admin" || role === "manager";
  const isTeamMember = role === "team_member";
  const isClient = role === "client";

  // ── Resolve client's brand ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isClient || !user) { setClientResolved(true); return; }
    backend
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMyClientId(data?.id || null);
        setClientResolved(true);
      });
  }, [isClient, user]);

  // ── Fetch team members (for detail sheet) ─────────────────────────────────
  useEffect(() => {
    if (isClient) return;
    backend.rpc("get_team_directory" as any).then(({ data }) => {
      if (data) setTeamMembers(data as Profile[]);
    });
  }, [isClient]);

  // ── Fetch client list for filter dropdown (admin/manager only) ─────────────
  useEffect(() => {
    if (!isAdmin) return;
    backend.from("clients").select("id, name").eq("is_active", true).order("name").then(({ data }) => {
      if (data) setClients(data as { id: string; name: string }[]);
    });
  }, [isAdmin]);

  // ── Fetch deliverables ────────────────────────────────────────────────────
  const fetchDeliverables = useCallback(async () => {
    if (isClient && !clientResolved) return;
    setLoading(true);

    const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;
    const endMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const endYear  = currentMonth === 11 ? currentYear + 1 : currentYear;
    const endDate  = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-01`;

    let query = backend
      .from("deliverables")
      .select(
        "id, title, type, status, due_date, assigned_to, priority, plan_id, description, approved_by, approved_at, monthly_plans(month, year, client_id, clients(name, brand_color))"
      )
      .gte("due_date", startDate)
      .lt("due_date", endDate)
      .order("due_date");

    // Role-scoped filtering
    if (isTeamMember && user) {
      query = query.eq("assigned_to", user.id);
    } else if (isClient) {
      if (!myClientId) {
        setDeliverables([]);
        setLoading(false);
        return;
      }
      // Filter by client_id via join: use eq on the related column
      query = query.eq("monthly_plans.client_id", myClientId);
    }

    const { data } = await query;
    const rows = (data as unknown as Deliverable[]) || [];

    // For client role, filter out rows where monthly_plans is null (didn't match join filter)
    const filtered = isClient
      ? rows.filter((d) => d.monthly_plans?.client_id === myClientId)
      : rows;

    setDeliverables(filtered);
    setLoading(false);
  }, [currentMonth, currentYear, isClient, isTeamMember, myClientId, clientResolved, user]);

  useEffect(() => { fetchDeliverables(); }, [fetchDeliverables]);

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay  = new Date(currentYear, currentMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth, currentYear]);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (clientFilter !== "all" && d.monthly_plans?.client_id !== clientFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const title = d.title.toLowerCase();
        const client = (d.monthly_plans?.clients?.name || "").toLowerCase();
        if (!title.includes(q) && !client.includes(q)) return false;
      }
      return true;
    });
  }, [deliverables, statusFilter, typeFilter, clientFilter, search]);

  const deliverablesByDate = useMemo(() => {
    const map: Record<string, Deliverable[]> = {};
    filteredDeliverables.forEach((d) => {
      if (!d.due_date) return;
      const day = parseInt(d.due_date.split("-")[2], 10);
      const key = String(day);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    });
    return map;
  }, [filteredDeliverables]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigate = (dir: -1 | 1) => {
    let m = currentMonth + dir;
    let y = currentYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCurrentMonth(m);
    setCurrentYear(y);
  };

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  // ── Active filter count ────────────────────────────────────────────────────
  const activeFilterCount = [statusFilter, typeFilter, clientFilter].filter(v => v !== "all").length + (search ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setClientFilter("all");
  };

  // ── Open deliverable detail ────────────────────────────────────────────────
  const openDeliverable = (d: Deliverable) => {
    if (isClient) return; // clients get read-only popover only
    setSelectedDeliverable(d as unknown as DeliverableForSheet);
    setSheetOpen(true);
    setOpenDay(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isClient ? "Your brand's content schedule." : "Monthly content calendar with deliverable deadlines."}
          </p>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-card border border-border rounded-xl">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search deliverables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {["all", ...Object.keys(STATUS_LABELS)].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {s === "all" ? "All Status" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Type filter (admin/manager) */}
        {isAdmin && (
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Client filter (admin/manager) */}
        {isAdmin && clients.length > 0 && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 text-xs w-[140px]">
              <SelectValue placeholder="Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1.5">
            <SlidersHorizontal className="h-3 w-3" />
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* ── Month navigation ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold min-w-[170px] text-center">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filteredDeliverables.length} deliverable{filteredDeliverables.length !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setCurrentMonth(today.getMonth());
              setCurrentYear(today.getFullYear());
            }}
          >
            Today
          </Button>
        </div>
      </div>

      {/* ── Calendar grid ── */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {/* Day header */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayDeliverables = day ? deliverablesByDate[String(day)] || [] : [];
            const hasDels = dayDeliverables.length > 0;
            const todayDay = day !== null && isToday(day);

            return (
              <Popover
                key={i}
                open={openDay === day && hasDels}
                onOpenChange={(open) => {
                  if (!open) setOpenDay(null);
                  else if (hasDels && day !== null) setOpenDay(day);
                }}
              >
                <PopoverTrigger asChild>
                  <div
                    className={`min-h-[110px] border-b border-r border-border p-1.5 transition-colors ${
                      day === null ? "bg-muted/20" : ""
                    } ${todayDay ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""} ${
                      hasDels && day !== null ? "cursor-pointer hover:bg-muted/30" : ""
                    }`}
                    onClick={() => {
                      if (hasDels && day !== null) setOpenDay(openDay === day ? null : day);
                    }}
                  >
                    {day !== null && (
                      <>
                        {/* Day number */}
                        <span
                          className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full mb-1 ${
                            todayDay
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {day}
                        </span>

                        {/* Loading skeleton */}
                        {loading ? (
                          <div className="space-y-1 mt-1">
                            <Skeleton className="h-4 w-full rounded" />
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {dayDeliverables.slice(0, 3).map((d) => (
                              <div
                                key={d.id}
                                className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border-l-2 truncate ${STATUS_CHIP[d.status] || "bg-muted/40"}`}
                                title={`${d.title}${d.monthly_plans?.clients?.name ? ` · ${d.monthly_plans.clients.name}` : ""}`}
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  {d.monthly_plans?.clients?.brand_color && (
                                    <span
                                      className="shrink-0 w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: d.monthly_plans.clients.brand_color }}
                                    />
                                  )}
                                  <span className="truncate font-medium">{d.title}</span>
                                </div>
                              </div>
                            ))}
                            {dayDeliverables.length > 3 && (
                              <div className="text-[10px] text-primary font-medium px-1.5 py-0.5">
                                +{dayDeliverables.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </PopoverTrigger>

                {/* ── Day expanded popover ── */}
                {hasDels && day !== null && (
                  <PopoverContent
                    side="bottom"
                    align="start"
                    className="w-80 p-0 max-h-[480px] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Popover header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 sticky top-0">
                      <div>
                        <p className="font-semibold text-sm">
                          {new Date(currentYear, currentMonth, day).toLocaleDateString("en-US", {
                            weekday: "long", month: "long", day: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {dayDeliverables.length} deliverable{dayDeliverables.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setOpenDay(null)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Deliverable list */}
                    <div className="divide-y divide-border">
                      {dayDeliverables.map((d) => (
                        <div
                          key={d.id}
                          className={`px-4 py-3 transition-colors ${
                            !isClient ? "cursor-pointer hover:bg-muted/30" : ""
                          }`}
                          onClick={() => !isClient && openDeliverable(d)}
                        >
                          {/* Title row */}
                          <div className="flex items-start gap-2 mb-1.5">
                            {d.monthly_plans?.clients?.brand_color && (
                              <span
                                className="mt-1 shrink-0 w-2 h-2 rounded-full"
                                style={{ backgroundColor: d.monthly_plans.clients.brand_color }}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-tight truncate">{d.title}</p>
                              {d.monthly_plans?.clients?.name && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {d.monthly_plans.clients.name}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Badges row */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Status */}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[d.status]}`} />
                              {STATUS_LABELS[d.status]}
                            </span>

                            {/* Type */}
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                              {TYPE_LABELS[d.type] || d.type}
                            </Badge>

                            {/* Priority */}
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${PRIORITY_BADGE[d.priority] || ""}`}>
                              {d.priority}
                            </span>
                          </div>

                          {!isClient && (
                            <p className="text-[10px] text-primary mt-1.5 font-medium">Click to open →</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground flex-wrap">
        {Object.entries(STATUS_DOT).map(([status, dotClass]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className="capitalize">{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {/* ── No deliverables empty state ── */}
      {!loading && filteredDeliverables.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {isClient && !myClientId ? (
            <p className="text-sm">Your account isn't linked to a brand yet. Contact your account manager.</p>
          ) : activeFilterCount > 0 ? (
            <p className="text-sm">No deliverables match your filters. <button onClick={clearFilters} className="text-primary underline">Clear filters</button></p>
          ) : (
            <p className="text-sm">No deliverables due this month.</p>
          )}
        </div>
      )}

      {/* ── Deliverable detail sheet ── */}
      {!isClient && (
        <DeliverableDetailSheet
          deliverable={selectedDeliverable}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onRefresh={fetchDeliverables}
          teamMembers={teamMembers}
          canManage={isAdmin}
        />
      )}
    </div>
  );
}
