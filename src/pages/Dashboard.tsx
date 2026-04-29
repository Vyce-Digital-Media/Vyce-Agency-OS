import { useEffect, useState, useMemo, useCallback } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Users, CalendarRange, FileText, CheckCircle2, AlertTriangle, Clock,
  Eye, ChevronDown, ChevronRight, TrendingUp, BarChart3, ArrowRight,
  Calendar, Star, Zap, Target, LogIn, LogOut, Coffee, Timer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import DeliverableDetailSheet, { DeliverableForSheet } from "@/components/DeliverableDetailSheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { format, addDays, parseISO, differenceInSeconds } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  plan_id: string;
  priority: string;
  description: string | null;
  monthly_plans: {
    month: number;
    year: number;
    client_id: string;
    clients: { name: string; brand_color: string | null } | null;
  } | null;
}

interface Plan {
  id: string;
  client_id: string;
  plan_type: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  total_deliverables: number;
  month: number;
  year: number;
  clients: { name: string; brand_color: string | null } | null;
}

interface Client {
  id: string;
  name: string;
  brand_color: string | null;
  is_active: boolean;
}

interface Profile {
  user_id: string;
  full_name: string;
  internal_label: string | null;
}

interface DashTimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  duration_minutes: number | null;
  date: string;
  notes: string | null;
  is_break: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function DashElapsedTimer({ clockIn }: { clockIn: string }) {
  const [seconds, setSeconds] = useState(() =>
    differenceInSeconds(new Date(), new Date(clockIn))
  );
  useEffect(() => {
    const iv = setInterval(() => setSeconds(differenceInSeconds(new Date(), new Date(clockIn))), 1000);
    return () => clearInterval(iv);
  }, [clockIn]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (
    <span className="font-mono tabular-nums font-bold text-xl text-primary">
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

function entryMinutes(e: { clock_in: string; clock_out: string | null; duration_minutes: number | null }): number {
  if (e.duration_minutes != null && e.duration_minutes > 0) return e.duration_minutes;
  if (!e.clock_out) return 0;
  const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.round(ms / 60000));
}

function dashFormatDuration(minutes: number | null): string {
  if (!minutes || minutes < 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  in_review: "In Review",
  needs_approval: "Needs Approval",
  approved: "Approved",
  delivered: "Delivered",
};

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  in_review: "bg-warning/10 text-warning",
  needs_approval: "bg-accent/10 text-accent",
  approved: "bg-success/10 text-success",
  delivered: "bg-success/10 text-success",
};

const TYPE_LABELS: Record<string, string> = {
  post: "Post", reel: "Reel", story: "Story", ad: "Ad",
  campaign: "Campaign", blog: "Blog", newsletter: "Newsletter", other: "Other",
};

const PLAN_TYPE_LABELS: Record<string, string> = {
  social_media: "Social Media",
  website_development: "Website Dev",
  content_creation: "Content",
  branding: "Branding",
  other: "Other",
};

const PLAN_TYPE_COLORS: Record<string, string> = {
  social_media: "hsl(var(--primary))",
  website_development: "hsl(var(--info))",
  content_creation: "hsl(var(--warning))",
  branding: "hsl(var(--accent))",
  other: "hsl(var(--muted-foreground))",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDeliverableForSheet(d: Deliverable): DeliverableForSheet {
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    type: d.type,
    status: d.status,
    due_date: d.due_date,
    assigned_to: d.assigned_to,
    plan_id: d.plan_id,
    priority: d.priority,
    approved_by: null,
    approved_at: null,
    monthly_plans: d.monthly_plans
      ? {
          month: d.monthly_plans.month,
          year: d.monthly_plans.year,
          clients: d.monthly_plans.clients
            ? { name: d.monthly_plans.clients.name, brand_color: d.monthly_plans.clients.brand_color || "#3B82F6" }
            : null,
        }
      : null,
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon: Icon, color, subLabel, onClick,
}: {
  label: string; value: number | string; icon: React.ElementType;
  color: string; subLabel?: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`stat-card group transition-all ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {subLabel && <p className="text-xs text-muted-foreground mt-1">{subLabel}</p>}
      {onClick && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
          View all <ArrowRight className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}

function CollapsibleFeedSection({
  title, count, colorClass, icon: Icon, children, defaultOpen = true,
}: {
  title: string; count: number; colorClass: string; icon: React.ElementType;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (count === 0) return null;
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left mb-2 group"
      >
        <Icon className={`h-4 w-4 ${colorClass}`} />
        <span className={`text-sm font-semibold ${colorClass}`}>{title}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colorClass} bg-current/10`}
          style={{ color: "inherit" }}>
          <span className="mix-blend-multiply dark:mix-blend-normal">{count}</span>
        </span>
        <div className="ml-auto">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      {open && <div className="stat-card p-1.5 space-y-0.5">{children}</div>}
    </div>
  );
}

function DeliverableRow({
  d, getProfileName, onClick,
}: {
  d: Deliverable; getProfileName: (id: string | null) => string; onClick: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const daysOverdue = d.due_date && d.due_date < today
    ? Math.floor((new Date(today).getTime() - new Date(d.due_date).getTime()) / 86400000)
    : null;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
    >
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: d.monthly_plans?.clients?.brand_color || "#3B82F6" }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{d.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {d.monthly_plans?.clients?.name}
          {" · "}{getProfileName(d.assigned_to)}
          {d.due_date && ` · ${d.due_date}`}
          {daysOverdue !== null && daysOverdue > 0 && (
            <span className="text-destructive font-medium"> ({daysOverdue}d overdue)</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`status-badge text-[10px] ${STATUS_STYLES[d.status]}`}>
          {STATUS_LABELS[d.status]}
        </span>
        {d.priority === "high" && <Zap className="h-3 w-3 text-destructive" />}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { profile, role, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeliverable, setSelectedDeliverable] = useState<DeliverableForSheet | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Time tracking state (team_member view) ────────────────────────────────
  const [clockEntry, setClockEntry] = useState<DashTimeEntry | null>(null);
  const [breakEntry, setBreakEntry] = useState<DashTimeEntry | null>(null);
  const [todayTimeMin, setTodayTimeMin] = useState(0);
  const [todayBreakMin, setTodayBreakMin] = useState(0);
  const [weekTimeMin, setWeekTimeMin] = useState(0);
  const [weekBreakMin, setWeekBreakMin] = useState(0);
  const [shiftNote, setShiftNote] = useState("");
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const nowDate = new Date();

  useEffect(() => {
    const fetchAll = async () => {
      const [clientsRes, plansRes, deliverablesRes, profilesRes] = await Promise.all([
        backend.from("clients").select("id, name, brand_color, is_active").eq("is_active", true),
        backend.from("monthly_plans").select("id, client_id, plan_type, status, start_date, end_date, total_deliverables, month, year, clients(name, brand_color)"),
        backend.from("deliverables").select("*, monthly_plans(month, year, client_id, clients(name, brand_color))"),
        backend.rpc("get_team_directory" as any),
      ]);
      setClients((clientsRes.data as Client[]) || []);
      setPlans((plansRes.data as unknown as Plan[]) || []);
      setDeliverables((deliverablesRes.data as unknown as Deliverable[]) || []);
      setProfiles((profilesRes.data as Profile[]) || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Time tracking fetch (only for team_member) ────────────────────────────
  const fetchTimeData = useCallback(async () => {
    if (!user) return;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const [openWorkRes, openBreakRes, recentRes, breaksRes] = await Promise.all([
      backend.from("time_entries" as any).select("*")
        .eq("user_id", user.id).eq("date", today).eq("is_break", false).is("clock_out", null).maybeSingle(),
      backend.from("time_entries" as any).select("*")
        .eq("user_id", user.id).eq("date", today).eq("is_break", true).is("clock_out", null).maybeSingle(),
      backend.from("time_entries" as any).select("*")
        .eq("user_id", user.id).eq("is_break", false).gte("date", weekStartStr)
        .order("date", { ascending: true }).limit(50),
      backend.from("time_entries" as any).select("*")
        .eq("user_id", user.id).eq("is_break", true).gte("date", weekStartStr)
        .not("clock_out", "is", null).limit(100),
    ]);

    setClockEntry(openWorkRes.data ? (openWorkRes.data as unknown as DashTimeEntry) : null);
    setBreakEntry(openBreakRes.data ? (openBreakRes.data as unknown as DashTimeEntry) : null);

    const entries = (recentRes.data as unknown as DashTimeEntry[]) || [];
    const breaks = (breaksRes.data as unknown as DashTimeEntry[]) || [];
    const todayDone = entries.filter((e) => e.date === today && e.clock_out).reduce((s, e) => s + entryMinutes(e), 0);
    const weekDone = entries.filter((e) => e.clock_out).reduce((s, e) => s + entryMinutes(e), 0);
    const todayBreaks = breaks.filter((b) => b.date === today).reduce((s, b) => s + entryMinutes(b), 0);
    const weekBreaks = breaks.reduce((s, b) => s + entryMinutes(b), 0);
    setTodayTimeMin(todayDone);
    setWeekTimeMin(weekDone);
    setTodayBreakMin(todayBreaks);
    setWeekBreakMin(weekBreaks);
  }, [user, today]);

  useEffect(() => {
    if (role === "team_member") fetchTimeData();
  }, [role, fetchTimeData]);

  // ── Clock actions ─────────────────────────────────────────────────────────
  const handleClockIn = useCallback(async () => {
    if (!user || clockingIn) return;
    setClockingIn(true);
    const { error } = await backend.from("time_entries" as any).insert({
      user_id: user.id, date: today,
      clock_in: new Date().toISOString(),
      notes: shiftNote || null, is_break: false,
    });
    if (error) {
      toast({ title: "Clock-in failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Clocked in!", description: `Started at ${new Date().toLocaleTimeString()}` });
      setShiftNote(""); await fetchTimeData();
    }
    setClockingIn(false);
  }, [user, clockingIn, shiftNote, today, fetchTimeData, toast]);

  const handleClockOut = useCallback(async () => {
    if (!clockEntry || clockingOut) return;
    setClockingOut(true);
    if (breakEntry) {
      await backend.from("time_entries" as any).update({ clock_out: new Date().toISOString() }).eq("id", breakEntry.id);
    }
    const { error } = await backend.from("time_entries" as any).update({ clock_out: new Date().toISOString() }).eq("id", clockEntry.id);
    if (error) {
      toast({ title: "Clock-out failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Clocked out!", description: `Ended at ${new Date().toLocaleTimeString()}` });
    }
    await fetchTimeData();
    setClockingOut(false);
  }, [clockEntry, clockingOut, breakEntry, fetchTimeData, toast]);

  const handleStartBreak = useCallback(async () => {
    if (!user || !clockEntry || breakLoading) return;
    setBreakLoading(true);
    const { error } = await backend.from("time_entries" as any).insert({
      user_id: user.id, date: today, clock_in: new Date().toISOString(), is_break: true,
    });
    if (error) {
      toast({ title: "Break start failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Break started" });
    }
    await fetchTimeData();
    setBreakLoading(false);
  }, [user, clockEntry, breakLoading, today, fetchTimeData, toast]);

  const handleEndBreak = useCallback(async () => {
    if (!breakEntry || breakLoading) return;
    setBreakLoading(true);
    const { error } = await backend.from("time_entries" as any).update({ clock_out: new Date().toISOString() }).eq("id", breakEntry.id);
    if (error) {
      toast({ title: "Break end failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Break ended", description: "Welcome back!" });
    }
    await fetchTimeData();
    setBreakLoading(false);
  }, [breakEntry, breakLoading, fetchTimeData, toast]);

  const getProfileName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    return profiles.find((p) => p.user_id === userId)?.full_name || "Unknown";
  };

  const openSheet = (d: Deliverable) => {
    setSelectedDeliverable(toDeliverableForSheet(d));
    setSheetOpen(true);
  };

  // ─── Computed: Admin/Manager ─────────────────────────────────────
  const completed = useMemo(() =>
    deliverables.filter((d) => d.status === "approved" || d.status === "delivered"), [deliverables]);
  const overdue = useMemo(() =>
    deliverables.filter((d) => d.due_date && d.due_date < today && d.status !== "approved" && d.status !== "delivered"), [deliverables, today]);
  const inProgress = useMemo(() =>
    deliverables.filter((d) => d.status === "in_progress"), [deliverables]);
  const inReview = useMemo(() =>
    deliverables.filter((d) => d.status === "in_review"), [deliverables]);
  const needsApproval = useMemo(() =>
    deliverables.filter((d) => d.status === "needs_approval"), [deliverables]);

  const activePlans = useMemo(() =>
    plans.filter((p) => p.status === "active"), [plans]);

  // Completed this month
  const thisMonth = nowDate.getMonth() + 1;
  const thisYear = nowDate.getFullYear();
  const completedThisMonth = useMemo(() =>
    deliverables.filter((d) =>
      (d.status === "approved" || d.status === "delivered") &&
      d.monthly_plans?.month === thisMonth &&
      d.monthly_plans?.year === thisYear
    ), [deliverables, thisMonth, thisYear]);

  // Upcoming 7 days
  const upcoming7 = useMemo(() => {
    const limit = addDays(nowDate, 7).toISOString().split("T")[0];
    return deliverables
      .filter((d) => d.due_date && d.due_date >= today && d.due_date <= limit &&
        d.status !== "approved" && d.status !== "delivered")
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
      .slice(0, 12);
  }, [deliverables, today]);

  // Workload
  const workloadData = useMemo(() => {
    const map: Record<string, number> = {};
    deliverables
      .filter((d) => d.assigned_to && d.status !== "approved" && d.status !== "delivered")
      .forEach((d) => { map[d.assigned_to!] = (map[d.assigned_to!] || 0) + 1; });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([userId, count]) => ({ name: getProfileName(userId), count, overloaded: count > 5 }));
  }, [deliverables, profiles]);

  // Plan type breakdown
  const planTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    activePlans.forEach((p) => { map[p.plan_type] = (map[p.plan_type] || 0) + 1; });
    return Object.entries(map).map(([type, count]) => ({
      name: PLAN_TYPE_LABELS[type] || type, count, color: PLAN_TYPE_COLORS[type] || "hsl(var(--muted-foreground))",
    }));
  }, [activePlans]);

  // Client health
  const clientHealth = useMemo(() => {
    return clients.map((c) => {
      const clientDelivs = deliverables.filter(
        (d) => d.monthly_plans?.client_id === c.id
      );
      const done = clientDelivs.filter((d) => d.status === "approved" || d.status === "delivered").length;
      const total = clientDelivs.length;
      const clientOverdue = clientDelivs.filter(
        (d) => d.due_date && d.due_date < today && d.status !== "approved" && d.status !== "delivered"
      ).length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return { ...c, done, total, pct, clientOverdue };
    }).filter((c) => c.total > 0).sort((a, b) => b.clientOverdue - a.clientOverdue);
  }, [clients, deliverables, today]);

  // Team member computed
  const myDeliverables = useMemo(() =>
    deliverables.filter((d) => d.assigned_to === user?.id), [deliverables, user]);
  const myToday = useMemo(() =>
    myDeliverables.filter((d) => d.due_date === today && d.status !== "approved" && d.status !== "delivered"),
    [myDeliverables, today]);
  const myOverdue = useMemo(() =>
    myDeliverables.filter((d) => d.due_date && d.due_date < today && d.status !== "approved" && d.status !== "delivered"),
    [myDeliverables, today]);
  const myUpcoming = useMemo(() =>
    myDeliverables.filter((d) => d.due_date && d.due_date > today && d.status !== "approved" && d.status !== "delivered")
      .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || "")).slice(0, 6),
    [myDeliverables, today]);

  // ─── Loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="h-8 w-56 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="stat-card h-24 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="stat-card h-32 animate-pulse" />)}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="stat-card h-28 animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  // ─── Team Member View ────────────────────────────────────────────────
  if (role === "team_member") {
    const isWorking = !!clockEntry && !breakEntry;
    const isOnBreak = !!clockEntry && !!breakEntry;
    const notStarted = !clockEntry;

    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(nowDate, "EEEE, MMMM d")} · Your execution view
          </p>
        </div>

        {/* ── Clock In / Out Widget ── */}
        <div className="stat-card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Today's Time</h2>
            </div>
            <div>
              {isWorking && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />Working
                </span>
              )}
              {isOnBreak && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                  <Coffee className="h-3 w-3" />On Break
                </span>
              )}
              {notStarted && (
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Not started</span>
              )}
            </div>
          </div>

          {/* Live timer when clocked in */}
          {clockEntry && (
            <div className="flex items-center justify-between bg-muted/40 rounded-xl px-5 py-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Session started at {format(new Date(clockEntry.clock_in), "h:mm a")}</p>
                {clockEntry.notes && <p className="text-xs text-muted-foreground italic">"{clockEntry.notes}"</p>}
              </div>
              <div className="text-right">
                <DashElapsedTimer clockIn={clockEntry.clock_in} />
                {breakEntry && (
                  <p className="text-xs text-warning mt-1">
                    Break: <DashElapsedTimer clockIn={breakEntry.clock_in} />
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Shift note (only pre-clock-in) */}
          {notStarted && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1.5">What are you working on today? <span className="opacity-60">(optional)</span></p>
              <Textarea
                placeholder="e.g. Client A social posts, email campaign review..."
                value={shiftNote}
                onChange={(e) => setShiftNote(e.target.value)}
                className="text-sm resize-none h-16"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {notStarted ? (
              <Button onClick={handleClockIn} disabled={clockingIn} className="flex-1 gap-2" size="lg">
                <LogIn className="h-4 w-4" />
                {clockingIn ? "Clocking In…" : "Clock In"}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleClockOut} disabled={clockingOut}
                  variant="destructive" className="flex-1 gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  {clockingOut ? "Clocking Out…" : "Clock Out"}
                </Button>
                {!breakEntry ? (
                  <Button
                    onClick={handleStartBreak} disabled={breakLoading}
                    variant="outline" className="gap-2"
                  >
                    <Coffee className="h-4 w-4" />
                    Break
                  </Button>
                ) : (
                  <Button
                    onClick={handleEndBreak} disabled={breakLoading}
                    variant="outline" className="gap-2 border-warning text-warning hover:bg-warning/10"
                  >
                    <Coffee className="h-4 w-4" />
                    End Break
                  </Button>
                )}
              </>
            )}
          </div>

          {/* Daily / weekly summary (net = gross − breaks) */}
          {(todayTimeMin > 0 || weekTimeMin > 0) && (
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
              <div className="text-center">
                <p className="text-xl font-bold">{dashFormatDuration(Math.max(0, todayTimeMin - todayBreakMin))}</p>
                <p className="text-xs text-muted-foreground">Today (net)</p>
                {todayBreakMin > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {dashFormatDuration(todayTimeMin)} − {dashFormatDuration(todayBreakMin)} breaks
                  </p>
                )}
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{dashFormatDuration(Math.max(0, weekTimeMin - weekBreakMin))}</p>
                <p className="text-xs text-muted-foreground">This Week (net)</p>
                {weekBreakMin > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {dashFormatDuration(weekTimeMin)} − {dashFormatDuration(weekBreakMin)} breaks
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <KpiCard label="Due Today" value={myToday.length} icon={Clock} color="text-primary" />
          <KpiCard label="Overdue" value={myOverdue.length} icon={AlertTriangle} color="text-destructive" />
          <KpiCard
            label="Total Active"
            value={myDeliverables.filter((d) => d.status !== "approved" && d.status !== "delivered").length}
            icon={FileText}
            color="text-muted-foreground"
          />
        </div>

        {myOverdue.length > 0 && (
          <CollapsibleFeedSection title="Overdue" count={myOverdue.length} colorClass="text-destructive" icon={AlertTriangle}>
            {myOverdue.map((d) => <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />)}
          </CollapsibleFeedSection>
        )}

        {myToday.length > 0 && (
          <CollapsibleFeedSection title="Due Today" count={myToday.length} colorClass="text-primary" icon={Clock}>
            {myToday.map((d) => <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />)}
          </CollapsibleFeedSection>
        )}

        {myUpcoming.length > 0 && (
          <CollapsibleFeedSection title="Upcoming" count={myUpcoming.length} colorClass="text-muted-foreground" icon={CalendarRange} defaultOpen={true}>
            {myUpcoming.map((d) => <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />)}
          </CollapsibleFeedSection>
        )}

        {myDeliverables.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">All clear!</h3>
            <p className="text-muted-foreground text-sm">No tasks assigned to you yet.</p>
          </div>
        )}

        {selectedDeliverable && (
          <DeliverableDetailSheet
            deliverable={selectedDeliverable}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onRefresh={() => {}}
            teamMembers={profiles}
            canManage={false}
          />
        )}
      </div>
    );
  }

  // ─── Manager View ────────────────────────────────────────────────────
  if (role === "manager") {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(nowDate, "EEEE, MMMM d")} · Risk prevention & flow control
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard label="Needs Approval" value={needsApproval.length} icon={Star} color="text-accent" onClick={() => navigate("/deliverables")} />
          <KpiCard label="Overdue" value={overdue.length} icon={AlertTriangle} color="text-destructive" onClick={() => navigate("/deliverables")} />
          <KpiCard label="In Review" value={inReview.length} icon={Eye} color="text-warning" onClick={() => navigate("/deliverables")} />
          <KpiCard label="In Progress" value={inProgress.length} icon={Clock} color="text-primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-1">
            <CollapsibleFeedSection title="Needs Approval" count={needsApproval.length} colorClass="text-accent" icon={Star}>
              {needsApproval.map((d) => <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />)}
            </CollapsibleFeedSection>
            <CollapsibleFeedSection title="Overdue" count={overdue.length} colorClass="text-destructive" icon={AlertTriangle}>
              {overdue.slice(0, 10).map((d) => <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />)}
            </CollapsibleFeedSection>
            <CollapsibleFeedSection title="Pending Review" count={inReview.length} colorClass="text-warning" icon={Eye} defaultOpen={false}>
              {inReview.slice(0, 10).map((d) => <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />)}
            </CollapsibleFeedSection>
          </div>

          {/* Client Health */}
          <div>
            <div className="stat-card">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Client Health
              </h3>
              <div className="space-y-3">
                {clientHealth.slice(0, 8).map((c) => (
                  <div key={c.id} className="cursor-pointer hover:bg-muted/50 rounded p-1.5 -mx-1.5 transition-colors"
                    onClick={() => navigate(`/deliverables`)}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.brand_color || "#3B82F6" }} />
                      <span className="text-sm font-medium truncate flex-1">{c.name}</span>
                      {c.clientOverdue > 0 && (
                        <span className="text-[10px] bg-destructive/10 text-destructive font-medium px-1.5 py-0.5 rounded-full">
                          {c.clientOverdue} overdue
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${c.pct}%`,
                            backgroundColor: c.pct >= 80 ? "hsl(var(--success))" : c.pct >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">{c.done}/{c.total}</span>
                    </div>
                  </div>
                ))}
                {clientHealth.length === 0 && <p className="text-sm text-muted-foreground">No client data yet.</p>}
              </div>
            </div>
          </div>
        </div>

        {selectedDeliverable && (
          <DeliverableDetailSheet
            deliverable={selectedDeliverable}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            onRefresh={() => {}}
            teamMembers={profiles}
            canManage={true}
          />
        )}
      </div>
    );
  }

  // ─── Admin View ───────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(nowDate, "EEEE, MMMM d, yyyy")} · Agency health & accountability overview
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/calendar")}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </button>
          <button
            onClick={() => navigate("/deliverables")}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> Deliverables
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard
          label="Active Clients"
          value={clients.length}
          icon={Users}
          color="text-primary"
          subLabel="Brands managed"
          onClick={() => navigate("/clients")}
        />
        <KpiCard
          label="Active Plans"
          value={activePlans.length}
          icon={CalendarRange}
          color="text-info"
          subLabel="Running campaigns"
          onClick={() => navigate("/plans")}
        />
        <KpiCard
          label="Needs Approval"
          value={needsApproval.length}
          icon={Star}
          color="text-accent"
          subLabel="Awaiting sign-off"
          onClick={() => navigate("/deliverables")}
        />
        <KpiCard
          label="Overdue"
          value={overdue.length}
          icon={AlertTriangle}
          color="text-destructive"
          subLabel="Require attention"
          onClick={() => navigate("/deliverables")}
        />
        <KpiCard
          label="Done This Month"
          value={completedThisMonth.length}
          icon={CheckCircle2}
          color="text-success"
          subLabel={`${MONTHS[thisMonth - 1]} ${thisYear}`}
          onClick={() => navigate("/deliverables")}
        />
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT COLUMN ── */}
        <div className="lg:col-span-2 space-y-1">

          {/* Action Feed */}
          <CollapsibleFeedSection
            title="Needs Approval"
            count={needsApproval.length}
            colorClass="text-accent"
            icon={Star}
          >
            {needsApproval.map((d) => (
              <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />
            ))}
          </CollapsibleFeedSection>

          <CollapsibleFeedSection
            title="Overdue Tasks"
            count={overdue.length}
            colorClass="text-destructive"
            icon={AlertTriangle}
          >
            {overdue.slice(0, 12).map((d) => (
              <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />
            ))}
          </CollapsibleFeedSection>

          <CollapsibleFeedSection
            title="Pending Review"
            count={inReview.length}
            colorClass="text-warning"
            icon={Eye}
            defaultOpen={false}
          >
            {inReview.slice(0, 12).map((d) => (
              <DeliverableRow key={d.id} d={d} getProfileName={getProfileName} onClick={() => openSheet(d)} />
            ))}
          </CollapsibleFeedSection>

          {/* Workload Distribution */}
          {workloadData.length > 0 && (
            <div className="mt-4">
              <div className="stat-card">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Workload Distribution
                  <span className="text-xs text-muted-foreground font-normal ml-1">(active tasks)</span>
                </h3>
                <div className="space-y-2.5">
                  {workloadData.map(({ name, count, overloaded }) => {
                    const max = Math.max(...workloadData.map((w) => w.count));
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-sm min-w-[120px] truncate">{name}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(count / max) * 100}%`,
                              backgroundColor: overloaded ? "hsl(var(--destructive))" : "hsl(var(--primary))",
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-muted-foreground min-w-[24px] text-right">{count}</span>
                          {overloaded && (
                            <span className="text-[10px] text-destructive font-medium">overloaded</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Active Plans Summary */}
          {activePlans.length > 0 && (
            <div className="mt-4">
              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CalendarRange className="h-4 w-4 text-primary" /> Active Plans
                  </h3>
                  <button
                    onClick={() => navigate("/plans")}
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  {activePlans.slice(0, 6).map((p) => (
                    <div
                      key={p.id}
                      onClick={() => navigate("/plans")}
                      className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
                    >
                      <div
                        className="h-8 w-1 rounded-full shrink-0"
                        style={{ backgroundColor: p.clients?.brand_color || "#3B82F6" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.clients?.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {MONTHS[(p.month || 1) - 1]} {p.year} · {p.total_deliverables} deliverables
                        </p>
                      </div>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                        style={{ backgroundColor: (PLAN_TYPE_COLORS[p.plan_type] || "#6b7280") + "20", color: PLAN_TYPE_COLORS[p.plan_type] || "#6b7280" }}
                      >
                        {PLAN_TYPE_LABELS[p.plan_type] || p.plan_type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-5">

          {/* Client Health */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Client Health
              </h3>
              <button onClick={() => navigate("/clients")} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                View <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-3">
              {clientHealth.slice(0, 8).map((c) => (
                <div key={c.id} className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                  onClick={() => navigate("/deliverables")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: c.brand_color || "#3B82F6" }} />
                    <span className="text-sm font-medium truncate flex-1">{c.name}</span>
                    {c.clientOverdue > 0 && (
                      <span className="text-[10px] bg-destructive/10 text-destructive font-medium px-1.5 py-0.5 rounded-full shrink-0">
                        {c.clientOverdue} overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${c.pct}%`,
                          backgroundColor: c.pct >= 80 ? "hsl(var(--success))" : c.pct >= 50 ? "hsl(var(--warning))" : "hsl(var(--primary))",
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">{c.done}/{c.total}</span>
                  </div>
                </div>
              ))}
              {clientHealth.length === 0 && (
                <p className="text-sm text-muted-foreground py-2">No deliverable data yet.</p>
              )}
            </div>
          </div>

          {/* Plan Type Breakdown */}
          {planTypeData.length > 0 && (
            <div className="stat-card">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Plan Types
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={planTypeData} layout="vertical" barSize={10} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    cursor={{ fill: "hsl(var(--muted))" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {planTypeData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Upcoming 7 Days */}
          {upcoming7.length > 0 && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Next 7 Days
                </h3>
                <button onClick={() => navigate("/calendar")} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors">
                  Calendar <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1">
                {upcoming7.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => openSheet(d)}
                    className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors -mx-2"
                  >
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: d.monthly_plans?.clients?.brand_color || "#3B82F6" }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{d.title}</p>
                      <p className="text-[11px] text-muted-foreground">{d.monthly_plans?.clients?.name}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {d.due_date ? format(parseISO(d.due_date), "MMM d") : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats Footer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card text-center py-4">
              <p className="text-2xl font-bold">{inProgress.length}</p>
              <p className="text-xs text-muted-foreground mt-1">In Progress</p>
            </div>
            <div className="stat-card text-center py-4">
              <p className="text-2xl font-bold">{completed.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {deliverables.length === 0 && clients.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center mt-8">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">Agency HQ is ready</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Start by adding your first client to get your agency operations flowing.
          </p>
          <button
            onClick={() => navigate("/clients")}
            className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add First Client
          </button>
        </div>
      )}

      {selectedDeliverable && (
        <DeliverableDetailSheet
          deliverable={selectedDeliverable}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onRefresh={() => {}}
          teamMembers={profiles.map(p => ({ ...p, internal_label: null }))}
          canManage={true}
        />
      )}
    </div>
  );
}
