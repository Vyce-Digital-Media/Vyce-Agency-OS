import { useEffect, useState, useCallback, useMemo } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAttendanceData } from "@/context/AttendanceContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Clock, LogIn, LogOut, Coffee, Activity, Timer, TrendingUp,
  Users, Circle, CalendarIcon, BarChart3, ChevronLeft, ChevronRight,
  User, AlertTriangle, Pencil, Plus, Download, FileText,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import {
  format, startOfWeek, addDays, subDays, differenceInSeconds, parseISO,
  startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, subMonths, addMonths,
  getDay,
} from "date-fns";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  duration_seconds: number | null;
  date: string;
  notes: string | null;
  is_break: boolean;
}

interface ProfileRow {
  user_id: string;
  full_name: string;
  internal_label: string | null;
  avatar_url: string | null;
  expected_start_time: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY_STR = format(new Date(), "yyyy-MM-dd");

/**
 * Returns true if an entry is a "missed clock-out": the user clocked in on
 * a past date but never clocked out. We treat these as present (1 day) but
 * with 0 worked seconds, and surface a warning in the UI.
 */
function isMissedClockOut(entry: { clock_out: string | null; date: string; is_break?: boolean }): boolean {
  if (entry.is_break) return false;
  if (entry.clock_out) return false;
  return entry.date < TODAY_STR;
}

/**
 * Returns the duration of a time entry in seconds.
 * Prefers the DB-computed `duration_seconds`, falls back to live calc from
 * timestamps so freshly-closed sessions render before the next refetch.
 * Returns 0 for sessions still in progress (no clock_out).
 */
function entrySeconds(e: { clock_in: string; clock_out: string | null; duration_seconds: number | null }): number {
  if (e.duration_seconds != null && e.duration_seconds > 0) return e.duration_seconds;
  if (!e.clock_out) return 0;
  const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / 1000);
}

function fmt(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  const totalSecs = Math.max(0, Math.round(seconds));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h === 0 && m === 0 && s === 0) return "0s";
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || (h === 0 && m === 0)) parts.push(`${s}s`);
  return parts.join(" ");
}

function fmtTime(ts: string | null): string {
  if (!ts) return "—";
  return format(new Date(ts), "h:mm a");
}

function attendanceBadge(clockIn: string, expected: string | null | undefined) {
  if (!expected) return null;
  const ci = new Date(clockIn);
  const [h, m] = expected.split(":").map(Number);
  const exp = new Date(ci);
  exp.setHours(h, m, 0, 0);
  const diff = (ci.getTime() - exp.getTime()) / 60000;
  if (diff <= 0) return { label: "On Time", cls: "bg-success/10 text-success" };
  if (diff <= 30) return { label: "Slight Delay", cls: "bg-warning/10 text-warning" };
  if (diff <= 120) return { label: "Late", cls: "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" };
  return { label: "Very Late", cls: "bg-destructive/10 text-destructive" };
}

function ElapsedTimer({ clockIn, compact = false }: { clockIn: string; compact?: boolean }) {
  const secs = useLiveDuration(clockIn);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (compact) return <span className="font-mono tabular-nums text-sm">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
  return <span className="font-mono tabular-nums font-bold text-2xl text-primary">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

function useLiveDuration(startTime: string | null | undefined) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!startTime) { setSecs(0); return; }
    const iv = setInterval(() => setSecs(differenceInSeconds(new Date(), new Date(startTime))), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  return secs;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function downloadCSV(filename: string, rows: string[][]): void {
  const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Clock Widget (shared) ────────────────────────────────────────────────────

function ClockWidget({
  openEntry, openBreak, onClockIn, onClockOut, onStartBreak, onEndBreak,
  shiftNote, setShiftNote, loading,
}: {
  openEntry: TimeEntry | null; openBreak: TimeEntry | null;
  onClockIn: () => void; onClockOut: () => void;
  onStartBreak: () => void; onEndBreak: () => void;
  shiftNote: string; setShiftNote: (v: string) => void;
  loading: { in: boolean; out: boolean; brk: boolean };
}) {
  const isWorking = !!openEntry && !openBreak;
  const isOnBreak = !!openEntry && !!openBreak;
  const notStarted = !openEntry;

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <div>
            <h2 className="text-base font-semibold">My Time</h2>
            <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, MMMM d")}</p>
          </div>
        </div>
        <div>
          {isWorking && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Working
            </span>
          )}
          {isOnBreak && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-warning bg-warning/10 px-2.5 py-1 rounded-full">
              <Coffee className="h-3 w-3" /> On Break
            </span>
          )}
          {notStarted && (
            <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Not started</span>
          )}
        </div>
      </div>

      {openEntry && (
        <div className="flex items-center justify-between bg-muted/40 rounded-xl px-5 py-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Clocked in at {fmtTime(openEntry.clock_in)}</p>
            {openEntry.notes && <p className="text-xs text-muted-foreground italic mt-0.5">"{openEntry.notes}"</p>}
          </div>
          <div className="text-right">
            <ElapsedTimer clockIn={openEntry.clock_in} />
            {openBreak && (
              <p className="text-xs text-warning mt-0.5">Break: <ElapsedTimer clockIn={openBreak.clock_in} compact /></p>
            )}
          </div>
        </div>
      )}

      {notStarted && (
        <div className="mb-4">
          <Label className="text-xs text-muted-foreground mb-1.5 block">What are you working on today? <span className="opacity-60">(optional)</span></Label>
          <Textarea
            placeholder="e.g. Client A social posts, email campaign review..."
            value={shiftNote}
            onChange={(e) => setShiftNote(e.target.value)}
            className="text-sm resize-none h-16"
          />
        </div>
      )}

      <div className="flex gap-2">
        {notStarted ? (
          <Button onClick={onClockIn} disabled={loading.in} className="flex-1 gap-2" size="lg">
            <LogIn className="h-4 w-4" />
            {loading.in ? "Clocking In…" : "Clock In"}
          </Button>
        ) : (
          <>
            <Button onClick={onClockOut} disabled={loading.out} variant="destructive" className="flex-1 gap-2">
              <LogOut className="h-4 w-4" />
              {loading.out ? "Clocking Out…" : "Clock Out"}
            </Button>
            {!openBreak ? (
              <Button onClick={onStartBreak} disabled={loading.brk} variant="outline" className="gap-2">
                <Coffee className="h-4 w-4" />
                {loading.brk ? "…" : "Break"}
              </Button>
            ) : (
              <Button onClick={onEndBreak} disabled={loading.brk} variant="outline" className="gap-2 border-warning text-warning hover:bg-warning/10">
                <Coffee className="h-4 w-4" />
                {loading.brk ? "…" : "End Break"}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Attendance Page ─────────────────────────────────────────────────────

export default function Attendance() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin" || role === "manager";

  // ── Shared clock state ─────────────────────────────────────────────────────
  // Clock state from global context (shared with Dashboard)
  const { status: attendanceStatus, refreshStatus } = useAttendanceData();
  const openEntry = (attendanceStatus?.active_work ?? null) as TimeEntry | null;
  const openBreak = (attendanceStatus?.active_break ?? null) as TimeEntry | null;

  const [shiftNote, setShiftNote] = useState("");
  const [clockLoading, setClockLoading] = useState({ in: false, out: false, brk: false });

  // ── Personal history state ─────────────────────────────────────────────────
  const [histMonth, setHistMonth] = useState(new Date().getMonth());
  const [histYear, setHistYear] = useState(new Date().getFullYear());
  const [myEntries, setMyEntries] = useState<TimeEntry[]>([]);
  const [myBreakEntries, setMyBreakEntries] = useState<TimeEntry[]>([]);
  const [myProfile, setMyProfile] = useState<ProfileRow | null>(null);

  // ── Admin state ────────────────────────────────────────────────────────────
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [allEntries, setAllEntries] = useState<TimeEntry[]>([]);
  const [allBreaks, setAllBreaks] = useState<TimeEntry[]>([]);
  const [logDate, setLogDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [analyticsWeekOffset, setAnalyticsWeekOffset] = useState(0);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [memberHistMonth, setMemberHistMonth] = useState(new Date().getMonth());
  const [memberHistYear, setMemberHistYear] = useState(new Date().getFullYear());
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [expectedInput, setExpectedInput] = useState("");
  const [loading, setLoading] = useState(true);

  // ── Edit entry state ───────────────────────────────────────────────────────
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ── Add entry on behalf state ──────────────────────────────────────────────
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [addEntryUserId, setAddEntryUserId] = useState("");
  const [addEntryDate, setAddEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [addEntryClockIn, setAddEntryClockIn] = useState("");
  const [addEntryClockOut, setAddEntryClockOut] = useState("");
  const [addEntryNotes, setAddEntryNotes] = useState("");
  const [addEntrySaving, setAddEntrySaving] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  // ── Fetch personal data ────────────────────────────────────────────────────
  const fetchMyData = useCallback(async () => {
    if (!user) return;
    const monthStart = format(new Date(histYear, histMonth, 1), "yyyy-MM-dd");
    const monthEnd = format(new Date(histYear, histMonth + 1, 0), "yyyy-MM-dd");

    const [entriesRes, breaksRes, profileRes] = await Promise.all([
      backend.from("time_entries" as any).select("*")
        .eq("user_id", user.id).eq("is_break", false)
        .gte("date", monthStart).lte("date", monthEnd)
        .order("clock_in", { ascending: false }),
      backend.from("time_entries" as any).select("*")
        .eq("user_id", user.id).eq("is_break", true)
        .gte("date", monthStart).lte("date", monthEnd)
        .not("clock_out", "is", null),
      backend.from("profiles" as any).select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    setMyEntries((entriesRes.data as unknown as TimeEntry[]) || []);
    setMyBreakEntries((breaksRes.data as unknown as TimeEntry[]) || []);
    setMyProfile(profileRes.data ? (profileRes.data as unknown as ProfileRow) : null);
  }, [user, histMonth, histYear]);

  // ── Fetch admin data ─────────────────────────────────────────────────────────
  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    const rangeStart = format(subDays(new Date(), 60), "yyyy-MM-dd");
    const calStart = format(startOfMonth(calMonth), "yyyy-MM-dd");
    const calEnd = format(endOfMonth(calMonth), "yyyy-MM-dd");
    const earliest = [rangeStart, calStart].sort()[0];
    const latest = [calEnd, todayStr].sort().reverse()[0];

    const [profilesRes, workRes, breaksRes] = await Promise.all([
      backend.rpc("get_team_directory" as any),
      backend.from("time_entries" as any).select("*")
        .eq("is_break", false).gte("date", earliest).lte("date", latest).order("clock_in"),
      backend.from("time_entries" as any).select("*")
        .eq("is_break", true).gte("date", earliest).lte("date", latest),
    ]);

    setProfiles((profilesRes.data as unknown as ProfileRow[]) || []);
    setAllEntries((workRes.data as unknown as TimeEntry[]) || []);
    setAllBreaks((breaksRes.data as unknown as TimeEntry[]) || []);
    setLoading(false);
  }, [isAdmin, calMonth, todayStr]);

  useEffect(() => { fetchMyData(); }, [fetchMyData]);
  useEffect(() => { if (isAdmin) fetchAdminData(); else setLoading(false); }, [fetchAdminData, isAdmin]);

  // ── Clock actions ─────────────────────────────────────────────────────────
  const handleClockIn = async () => {
    if (!user) return;
    setClockLoading(p => ({ ...p, in: true }));
    const { error } = await backend.post("/attendance/clock-in", { notes: shiftNote || null });
    if (error) toast({ title: "Error", description: (error as any).message, variant: "destructive" });
    else { toast({ title: "Clocked in!", description: `Started at ${format(new Date(), "h:mm a")}` }); setShiftNote(""); }
    setClockLoading(p => ({ ...p, in: false }));
    await Promise.all([fetchMyData(), refreshStatus()]);
  };
  const handleClockOut = async () => {
    if (!openEntry) return;
    setClockLoading(p => ({ ...p, out: true }));
    const { error } = await backend.post("/attendance/clock-out");
    if (error) toast({ title: "Error", description: (error as any).message, variant: "destructive" });
    else toast({ title: "Clocked out!", description: `Ended at ${format(new Date(), "h:mm a")}` });
    setClockLoading(p => ({ ...p, out: false }));
    await Promise.all([fetchMyData(), refreshStatus()]);
  };

  const handleStartBreak = async () => {
    if (!user || !openEntry) return;
    setClockLoading(p => ({ ...p, brk: true }));
    const { error } = await backend.post("/attendance/break-start");
    if (error) toast({ title: "Error", description: (error as any).message, variant: "destructive" });
    else toast({ title: "Break started" });
    setClockLoading(p => ({ ...p, brk: false }));
    await Promise.all([fetchMyData(), refreshStatus()]);
  };

  const handleEndBreak = async () => {
    if (!openBreak) return;
    setClockLoading(p => ({ ...p, brk: true }));
    const { error } = await backend.post("/attendance/break-end");
    if (error) toast({ title: "Error", description: (error as any).message, variant: "destructive" });
    else toast({ title: "Break ended", description: "Welcome back!" });
    setClockLoading(p => ({ ...p, brk: false }));
    await Promise.all([fetchMyData(), refreshStatus()]);
  };

  // ── Save expected start time ───────────────────────────────────────────────
  const handleSaveExpected = async (userId: string) => {
    const { error } = await backend.from("profiles" as any)
      .update({ expected_start_time: expectedInput || null }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Expected start time saved" }); setEditingExpected(null); await fetchAdminData(); }
  };

  // ── Edit time entry (admin) ────────────────────────────────────────────────
  const openEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry);
    // Format for datetime-local input: "yyyy-MM-ddTHH:mm"
    setEditClockIn(format(new Date(entry.clock_in), "yyyy-MM-dd'T'HH:mm"));
    setEditClockOut(entry.clock_out ? format(new Date(entry.clock_out), "yyyy-MM-dd'T'HH:mm") : "");
    setEditNotes(entry.notes || "");
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setEditSaving(true);
    const { error } = await backend.from("time_entries" as any).update({
      clock_in: new Date(editClockIn).toISOString(),
      clock_out: editClockOut ? new Date(editClockOut).toISOString() : null,
      notes: editNotes || null,
    }).eq("id", editingEntry.id);
    setEditSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Entry updated" });
      setEditingEntry(null);
      await fetchAdminData();
    }
  };

  // ── Add entry on behalf (admin) ────────────────────────────────────────────
  const handleAddEntry = async () => {
    if (!addEntryUserId || !addEntryDate || !addEntryClockIn) return;
    setAddEntrySaving(true);
    const clockInISO = new Date(`${addEntryDate}T${addEntryClockIn}`).toISOString();
    const clockOutISO = addEntryClockOut ? new Date(`${addEntryDate}T${addEntryClockOut}`).toISOString() : null;
    const { error } = await backend.from("time_entries" as any).insert({
      user_id: addEntryUserId,
      date: addEntryDate,
      clock_in: clockInISO,
      clock_out: clockOutISO,
      notes: addEntryNotes || null,
      is_break: false,
    });
    setAddEntrySaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Entry added" });
      setAddEntryOpen(false);
      setAddEntryUserId(""); setAddEntryClockIn(""); setAddEntryClockOut(""); setAddEntryNotes("");
      await fetchAdminData();
    }
  };

  // ── Export: Daily Log CSV ──────────────────────────────────────────────────
  const exportDailyLogCSV = () => {
    const header = ["Member", "Role", "Expected Start", "Clock In", "Clock Out", "Gross Hours", "Break", "Net Hours", "Attendance", "Notes"];
    const rows = logEntries.map(e => {
      const p = profileMap[e.user_id];
      const breakSecs = logBreaks.filter(b => b.user_id === e.user_id).reduce((s, b) => s + entrySeconds(b), 0);
      const missed = isMissedClockOut(e);
      const grossSecs = missed ? 0 : entrySeconds(e);
      const netSecs = grossSecs - breakSecs;
      const badge = attendanceBadge(e.clock_in, p?.expected_start_time);
      return [
        p?.full_name || "Unknown",
        p?.internal_label || "Team Member",
        p?.expected_start_time?.slice(0, 5) || "",
        fmtTime(e.clock_in),
        e.clock_out ? fmtTime(e.clock_out) : (missed ? "Missing" : "Active"),
        grossSecs ? (grossSecs / 3600).toFixed(2) : "",
        breakSecs > 0 ? (breakSecs / 3600).toFixed(2) : "0",
        e.clock_out ? (netSecs / 3600).toFixed(2) : (missed ? "0" : ""),
        badge?.label || "",
        e.notes || "",
      ];
    });
    downloadCSV(`daily-log-${logDateStr}.csv`, [header, ...rows]);
  };


  // ── Personal derived stats ─────────────────────────────────────────────────
  const activeWorkSecs = useLiveDuration(openEntry?.clock_in);
  const activeBreakSecs = useLiveDuration(openBreak?.clock_in);

  const myCompletedEntries = myEntries.filter(e => e.clock_out);
  const myTotalSecs = myCompletedEntries.reduce((s, e) => s + entrySeconds(e), 0) + activeWorkSecs;
  const myDaysPresent = new Set(myEntries.filter(e => e.clock_out || isMissedClockOut(e)).map(e => e.date)).size;
  const myAvgSecs = myDaysPresent > 0 ? Math.round(myTotalSecs / myDaysPresent) : 0;
  const myTotalBreakSecs = myBreakEntries.reduce((s, e) => s + entrySeconds(e), 0) + activeBreakSecs;
  const myNetSecs = myTotalSecs - myTotalBreakSecs;

  const todayDoneSecs = myCompletedEntries.filter(e => e.date === todayStr).reduce((s, e) => s + entrySeconds(e), 0);
  const todayBreakSecs = myBreakEntries.filter(e => e.date === todayStr).reduce((s, e) => s + entrySeconds(e), 0);
  
  const todayGrossTotalSecs = todayDoneSecs + activeWorkSecs;
  const todayBreakTotalSecs = todayBreakSecs + activeBreakSecs;
  const todayNetTotalSecs = todayGrossTotalSecs - todayBreakTotalSecs;

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const myWeekSecs = myEntries.filter(e => e.date >= weekStart && (e.clock_out || !e.clock_out)).reduce((s, e) => s + (e.clock_out ? entrySeconds(e) : activeWorkSecs), 0);

  // ── Admin derived stats ────────────────────────────────────────────────────
  const profileMap = useMemo(() => {
    const m: Record<string, ProfileRow> = {};
    profiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  const teamMembers = useMemo(() => profiles.filter(p => p.user_id !== user?.id || isAdmin), [profiles, user, isAdmin]);

  // Who's in right now
  const activeWork = useMemo(() =>
    allEntries.filter(e => !e.clock_out), [allEntries]);
  const activeBreaks = useMemo(() =>
    allBreaks.filter(e => !e.clock_out), [allBreaks]);
  const breakUserIds = useMemo(() => new Set(activeBreaks.map(e => e.user_id)), [activeBreaks]);
  const clockedInCount = activeWork.filter(e => !breakUserIds.has(e.user_id)).length;
  const onBreakCount = activeWork.filter(e => breakUserIds.has(e.user_id)).length;
  const teamTodaySecs = allEntries.filter(e => e.date === todayStr && e.clock_out).reduce((s, e) => s + entrySeconds(e), 0);

  // Overtime helper: total worked today for a user (completed sessions)
  function getMemberTodayTotalSecs(userId: string): number {
    return allEntries.filter(e => e.user_id === userId && e.date === todayStr && e.clock_out)
      .reduce((s, e) => s + entrySeconds(e), 0);
  }

  // For a live session, estimate total including active session
  function getMemberTodayEstTotalSecs(userId: string): number {
    const done = getMemberTodayTotalSecs(userId);
    const active = activeWork.find(e => e.user_id === userId);
    if (!active) return done;
    return done + differenceInSeconds(new Date(), new Date(active.clock_in));
  }

  // Daily log entries
  const logDateStr = format(logDate, "yyyy-MM-dd");
  const logEntries = useMemo(() =>
    allEntries.filter(e => e.date === logDateStr).sort((a, b) => a.clock_in.localeCompare(b.clock_in)),
    [allEntries, logDateStr]);
  const logBreaks = useMemo(() =>
    allBreaks.filter(e => e.date === logDateStr), [allBreaks, logDateStr]);

  // Analytics - weekly grid
  const analyticsWeekStart = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), analyticsWeekOffset * 7);
  const analyticsWeekDays = Array.from({ length: 7 }, (_, i) => format(addDays(analyticsWeekStart, i), "yyyy-MM-dd"));

  function getMemberDaySecs(userId: string, dateStr: string): number {
    return allEntries.filter(e => e.user_id === userId && e.date === dateStr && e.clock_out)
      .reduce((s, e) => s + entrySeconds(e), 0);
  }

  function cellStyle(min: number) {
    const h = min / 60;
    if (h <= 0) return "text-muted-foreground/40";
    if (h >= 7) return "text-success font-semibold";
    if (h >= 4) return "text-warning font-semibold";
    return "text-destructive font-semibold";
  }
  function cellBg(min: number) {
    const h = min / 60;
    if (h <= 0) return "";
    if (h >= 7) return "bg-success/10";
    if (h >= 4) return "bg-warning/10";
    return "bg-destructive/10";
  }

  // Trends - last 30 days team daily hours
  const trendDays = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), 29 - i), "yyyy-MM-dd"));
  const trendData = trendDays.map(d => ({
    date: format(parseISO(d), "M/d"),
    hours: +(allEntries.filter(e => e.date === d && e.clock_out).reduce((s, e) => s + entrySeconds(e), 0) / 3600).toFixed(1),
  }));

  // Per-member avg hours (last 30 days)
  const memberAvgData = useMemo(() => {
    const days30Start = format(subDays(new Date(), 30), "yyyy-MM-dd");
    return teamMembers.map(p => {
      const entries = allEntries.filter(e => e.user_id === p.user_id && e.date >= days30Start && e.clock_out);
      const totalSecs = entries.reduce((s, e) => s + entrySeconds(e), 0);
      const days = new Set(entries.map(e => e.date)).size;
      return { name: p.full_name?.split(" ")[0] || "?", avg: days > 0 ? +(totalSecs / days / 3600).toFixed(1) : 0, userId: p.user_id };
    }).sort((a, b) => b.avg - a.avg);
  }, [teamMembers, allEntries]);

  // Attendance rate per member (last 30 working days)
  const memberAttendance = useMemo(() => {
    const days30Start = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const workDays = trendDays.filter(d => {
      const day = getDay(parseISO(d));
      return day !== 0 && day !== 6;
    }).length;
    return teamMembers.map(p => {
      const days = new Set(allEntries.filter(e => e.user_id === p.user_id && e.date >= days30Start && e.clock_out).map(e => e.date)).size;
      return { name: p.full_name?.split(" ")[0] || "?", rate: workDays > 0 ? Math.round((days / workDays) * 100) : 0 };
    }).sort((a, b) => b.rate - a.rate);
  }, [teamMembers, allEntries, trendDays]);

  // Individual member history
  const selectedProfile = profiles.find(p => p.user_id === selectedMember);
  const memberMonthStart = format(new Date(memberHistYear, memberHistMonth, 1), "yyyy-MM-dd");
  const memberMonthEnd = format(new Date(memberHistYear, memberHistMonth + 1, 0), "yyyy-MM-dd");
  const memberEntries = allEntries.filter(e => e.user_id === selectedMember && e.date >= memberMonthStart && e.date <= memberMonthEnd && e.clock_out);
  const memberBreaks = allBreaks.filter(e => e.user_id === selectedMember && e.date >= memberMonthStart && e.date <= memberMonthEnd && e.clock_out);
  const memberTotalSecs = memberEntries.reduce((s, e) => s + entrySeconds(e), 0);
  const memberBreakSecs = memberBreaks.reduce((s, e) => s + entrySeconds(e), 0);
  const memberNetSecs = memberTotalSecs - memberBreakSecs;
  const memberDaysPresent = new Set(memberEntries.map(e => e.date)).size;
  
  const allTimeMemberEntries = allEntries.filter(e => e.user_id === selectedMember && e.clock_out);
  const allTimeMemberSecs = allTimeMemberEntries.reduce((s, e) => s + entrySeconds(e), 0);


  // Calendar view
  const calDays = eachDayOfInterval({ start: startOfMonth(calMonth), end: endOfMonth(calMonth) });
  function getCalDayPresence(dateStr: string) {
    return allEntries.filter(e => e.date === dateStr && e.clock_out).length;
  }
  function getCalDayMembers(dateStr: string) {
    return allEntries.filter(e => e.date === dateStr && e.clock_out).map(e => ({
      entry: e,
      profile: profileMap[e.user_id],
      breakSecs: allBreaks.filter(b => b.user_id === e.user_id && b.date === dateStr && b.clock_out).reduce((s, b) => s + entrySeconds(b), 0),
    }));
  }

  const prevHistMonth = () => {
    if (histMonth === 0) { setHistMonth(11); setHistYear(y => y - 1); }
    else setHistMonth(m => m - 1);
  };
  const nextHistMonth = () => {
    const now = new Date();
    if (histYear > now.getFullYear() || (histYear === now.getFullYear() && histMonth >= now.getMonth())) return;
    if (histMonth === 11) { setHistMonth(0); setHistYear(y => y + 1); }
    else setHistMonth(m => m + 1);
  };

  const prevMemberMonth = () => {
    if (memberHistMonth === 0) { setMemberHistMonth(11); setMemberHistYear(y => y - 1); }
    else setMemberHistMonth(m => m - 1);
  };
  const nextMemberMonth = () => {
    const now = new Date();
    if (memberHistYear > now.getFullYear() || (memberHistYear === now.getFullYear() && memberHistMonth >= now.getMonth())) return;
    if (memberHistMonth === 11) { setMemberHistMonth(0); setMemberHistYear(y => y + 1); }
    else setMemberHistMonth(m => m + 1);
  };



  // ── Team Member View ───────────────────────────────────────────────────────
  if (role === "team_member") {
    return (
      <div className="animate-fade-in">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">Track your time and breaks.</p>
        </div>

        <Tabs defaultValue="my-time" className="space-y-6">
          <TabsList>
            <TabsTrigger value="my-time" className="gap-2"><Clock className="h-4 w-4" /> My Time</TabsTrigger>
            <TabsTrigger value="my-history" className="gap-2"><BarChart3 className="h-4 w-4" /> My History</TabsTrigger>
          </TabsList>

          {/* ── MY TIME ── */}
          <TabsContent value="my-time" className="space-y-6">
            <ClockWidget
              openEntry={openEntry} openBreak={openBreak}
              onClockIn={handleClockIn} onClockOut={handleClockOut}
              onStartBreak={handleStartBreak} onEndBreak={handleEndBreak}
              shiftNote={shiftNote} setShiftNote={setShiftNote}
              loading={clockLoading}
            />

            {/* Today summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Today (gross)", value: fmt(todayGrossTotalSecs) },
                { label: "Today (break)", value: fmt(todayBreakTotalSecs) },
                { label: "Today (net)", value: <span className="text-primary">{fmt(todayNetTotalSecs)}</span> },
                { label: "This Week", value: fmt(myWeekSecs) },
              ].map(({ label, value }) => (
                <div key={label} className="stat-card text-center py-4 border-primary/10 bg-primary/5">
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">{label}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ── MY HISTORY ── */}
          <TabsContent value="my-history" className="space-y-6">
            {/* Month selector */}
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={prevHistMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="font-semibold text-sm min-w-[110px] text-center">{MONTHS[histMonth]} {histYear}</span>
              <Button variant="outline" size="sm" onClick={nextHistMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            {/* Monthly summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Days Present", value: myDaysPresent },
                { label: "Total Hours", value: fmt(myTotalMinutes) },
                { label: "Avg Hours/Day", value: fmt(myAvgMinutes) },
                { label: "Break Time", value: fmt(myTotalBreakMin) },
              ].map(({ label, value }) => (
                <div key={label} className="stat-card text-center py-4">
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>



            {/* Time log table */}
            <div className="stat-card">
              <h3 className="text-sm font-semibold mb-4">Time Log — {MONTHS[histMonth]} {histYear}</h3>
              {myEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No entries for this month.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Break</TableHead>
                        <TableHead>Net</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myEntries.map((e, idx) => {
                        const isThisEntryActive = !e.clock_out;
                        const entrySec = isThisEntryActive ? activeWorkSecs : entrySeconds(e);
                        // Only subtract daily break from the FIRST entry of that day to avoid double-deduction in total views
                        // But for display per row, maybe it's better to just show the entry's own net if we had break-association.
                        // Since we don't, we'll show "Entry Gross" and "Day Break" separately.
                        const dayBreakSecs = myBreakEntries.filter(b => b.date === e.date).reduce((s, b) => s + (b.clock_out ? entrySeconds(b) : activeBreakSecs), 0);
                        const isFirstEntryOfDay = idx === 0 || myEntries[idx - 1].date !== e.date;
                        const badge = attendanceBadge(e.clock_in, myProfile?.expected_start_time);

                        return (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{format(parseISO(e.date), "MMM d")}</TableCell>
                            <TableCell>{fmtTime(e.clock_in)}</TableCell>
                            <TableCell>{e.clock_out ? fmtTime(e.clock_out) : <span className="text-success font-medium text-xs animate-pulse">Active</span>}</TableCell>
                            <TableCell>{fmt(entrySec)}</TableCell>
                            <TableCell>{isFirstEntryOfDay ? (fmt(dayBreakSecs) !== "—" ? fmt(dayBreakSecs) : <span className="text-muted-foreground/40">—</span>) : <span className="text-muted-foreground/20">"</span>}</TableCell>
                            <TableCell className="font-medium">{isFirstEntryOfDay ? fmt(entrySec - dayBreakSecs) : fmt(entrySec)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{e.notes || "—"}</TableCell>
                            <TableCell>
                              {badge ? <span className={cn("status-badge", badge.cls)}>{badge.label}</span> : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ── Admin / Manager View ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="h-8 w-56 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="stat-card h-24 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground mt-1">Monitor team time and attendance.</p>
      </div>

      {/* ── Manager personal clock-in ── */}
      {role === "manager" && (
        <section className="mb-8 space-y-6">
          <ClockWidget
            openEntry={openEntry} openBreak={openBreak}
            onClockIn={handleClockIn} onClockOut={handleClockOut}
            onStartBreak={handleStartBreak} onEndBreak={handleEndBreak}
            shiftNote={shiftNote} setShiftNote={setShiftNote}
            loading={clockLoading}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Today (gross)", value: fmt(todayGrossTotalSecs) },
              { label: "Today (break)", value: fmt(todayBreakTotalSecs) },
              { label: "Today (net)", value: <span className="text-primary">{fmt(todayNetTotalSecs)}</span> },
              { label: "This Week", value: fmt(myWeekSecs) },
            ].map(({ label, value }) => (
              <div key={label} className="stat-card text-center py-4 border-primary/10 bg-primary/5">
                <p className="text-lg font-bold">{value}</p>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-medium">{label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Edit Entry Dialog ── */}
      <Dialog open={!!editingEntry} onOpenChange={open => !open && setEditingEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Member</Label>
              <p className="text-sm font-medium">{editingEntry ? profileMap[editingEntry.user_id]?.full_name || "Unknown" : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Clock In</Label>
                <Input type="datetime-local" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Clock Out <span className="opacity-60">(optional)</span></Label>
                <Input type="datetime-local" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Notes</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="text-sm resize-none h-16" placeholder="Shift notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving || !editClockIn}>
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Entry on Behalf Dialog ── */}
      <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Time Entry on Behalf</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Team Member</Label>
              <Select value={addEntryUserId} onValueChange={setAddEntryUserId}>
                <SelectTrigger><SelectValue placeholder="Select member…" /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Date</Label>
              <Input type="date" value={addEntryDate} onChange={e => setAddEntryDate(e.target.value)} max={todayStr} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Clock In Time</Label>
                <Input type="time" value={addEntryClockIn} onChange={e => setAddEntryClockIn(e.target.value)} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Clock Out <span className="opacity-60">(optional)</span></Label>
                <Input type="time" value={addEntryClockOut} onChange={e => setAddEntryClockOut(e.target.value)} className="text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Notes</Label>
              <Textarea value={addEntryNotes} onChange={e => setAddEntryNotes(e.target.value)} className="text-sm resize-none h-16" placeholder="Reason for manual entry…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEntryOpen(false)}>Cancel</Button>
            <Button onClick={handleAddEntry} disabled={addEntrySaving || !addEntryUserId || !addEntryClockIn}>
              {addEntrySaving ? "Adding…" : "Add Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="whos-in" className="space-y-6">
        <TabsList className="h-10 w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="whos-in" className="gap-2"><Activity className="h-4 w-4" /> Who's In</TabsTrigger>
          <TabsTrigger value="daily-log" className="gap-2"><Clock className="h-4 w-4" /> Daily Log</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2"><TrendingUp className="h-4 w-4" /> Analytics</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2"><CalendarIcon className="h-4 w-4" /> Calendar</TabsTrigger>
        </TabsList>

        {/* ══════════════════ WHO'S IN ══════════════════ */}
        <TabsContent value="whos-in" className="space-y-6">
          {/* KPI bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <Activity className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clockedInCount}</p>
                <p className="text-xs text-muted-foreground">Clocked In Now</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                <Coffee className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onBreakCount}</p>
                <p className="text-xs text-muted-foreground">On Break</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fmt(teamTodaySecs)}</p>
                <p className="text-xs text-muted-foreground">Team Hours Today</p>
              </div>
            </div>
          </div>

          {/* Who's In board */}
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              <h2 className="text-sm font-semibold">Live Status</h2>
              <span className="ml-auto text-xs text-muted-foreground">{format(new Date(), "h:mm a")}</span>
            </div>
            <div className="space-y-2">
              {teamMembers.sort((a, b) => {
                const aActive = activeWork.some(e => e.user_id === a.user_id);
                const bActive = activeWork.some(e => e.user_id === b.user_id);
                return Number(bActive) - Number(aActive);
              }).map(p => {
                const active = activeWork.find(e => e.user_id === p.user_id);
                const onBreak = breakUserIds.has(p.user_id);
                const activeSince = active?.clock_in;
                const todayNetSecs = getMemberTodayTotalSecs(p.user_id);
                const estTotalSecs = getMemberTodayEstTotalSecs(p.user_id);
                const isOvertime = estTotalSecs > 540 * 60; // 9 hours
                return (
                  <div key={p.user_id} className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-2.5 border transition-colors",
                    active && !onBreak ? "bg-success/5 border-success/20" :
                    onBreak ? "bg-warning/5 border-warning/20" :
                    "bg-muted/40 border-border/50"
                  )}>
                    <div className="flex items-center gap-3">
                      <Circle className={cn("h-2.5 w-2.5 fill-current shrink-0",
                        active && !onBreak ? "text-success" :
                        onBreak ? "text-warning" : "text-muted-foreground/30"
                      )} />
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {p.full_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{p.full_name}</p>
                          {isOvertime && active && (
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="h-2.5 w-2.5" /> Overtime
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.internal_label || "Team Member"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {active && !onBreak ? (
                        <>
                          <p className="text-xs text-success font-medium">Working</p>
                          <p className="text-xs text-muted-foreground">since {fmtTime(activeSince!)}</p>
                        </>
                      ) : onBreak ? (
                        <>
                          <p className="text-xs text-warning font-medium">On Break</p>
                          <p className="text-xs text-muted-foreground">since {fmtTime(activeSince!)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">Not clocked in</p>
                          {todayNetSecs > 0 && <p className="text-xs text-muted-foreground">{fmt(todayNetSecs)} today</p>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ══════════════════ DAILY LOG ══════════════════ */}
        <TabsContent value="daily-log" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-semibold">Daily Log</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => { setAddEntryDate(logDateStr); setAddEntryOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add Entry
              </Button>
              {logEntries.length > 0 && (
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={exportDailyLogCSV}>
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </Button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {format(logDate, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={logDate} onSelect={(d) => d && setLogDate(d)}
                    initialFocus className={cn("p-3 pointer-events-auto")} disabled={(d) => d > new Date()} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {logEntries.length === 0 ? (
            <div className="stat-card text-center py-12">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">No time entries for {format(logDate, "MMMM d, yyyy")}.</p>
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => { setAddEntryDate(logDateStr); setAddEntryOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add Entry Manually
              </Button>
            </div>
          ) : (
            <div className="stat-card overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Break</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logEntries.map(e => {
                    const p = profileMap[e.user_id];
                    const breakSecs = logBreaks.filter(b => b.user_id === e.user_id).reduce((s, b) => s + entrySeconds(b), 0);
                    const missed = isMissedClockOut(e);
                    const grossSecs = missed ? 0 : entrySeconds(e);
                    const netSecs = grossSecs - breakSecs;
                    const badge = attendanceBadge(e.clock_in, p?.expected_start_time);
                    const isOvertime = e.clock_out && netSecs > 540 * 60;
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                              {p?.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <span className="font-medium text-sm">{p?.full_name || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p?.expected_start_time ? p.expected_start_time.slice(0, 5) : "—"}
                        </TableCell>
                        <TableCell>{fmtTime(e.clock_in)}</TableCell>
                        <TableCell>
                          {e.clock_out ? fmtTime(e.clock_out)
                            : missed ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full"><AlertTriangle className="h-2.5 w-2.5" /> Missing</span>
                            : <span className="text-success font-medium text-xs">Active</span>}
                        </TableCell>
                        <TableCell>{e.clock_out ? fmt(e.duration_seconds) : missed ? <span className="text-muted-foreground">0h</span> : <ElapsedTimer clockIn={e.clock_in} compact />}</TableCell>
                        <TableCell>{breakSecs > 0 ? fmt(breakSecs) : "—"}</TableCell>
                        <TableCell className="font-medium">{e.clock_out ? fmt(netSecs) : missed ? <span className="text-muted-foreground">0h</span> : "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {missed ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full w-fit"><AlertTriangle className="h-2.5 w-2.5" /> No Clock Out</span>
                              : badge ? <span className={cn("status-badge", badge.cls)}>{badge.label}</span>
                              : <span className="text-xs text-muted-foreground">—</span>}
                            {isOvertime && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full w-fit">
                                <AlertTriangle className="h-2.5 w-2.5" /> Overtime
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{e.notes || "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 hover:opacity-100" onClick={() => openEditEntry(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {/* Summary row */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>{logEntries.length} member{logEntries.length !== 1 ? "s" : ""} logged</span>
                <span>
                  Team total: <strong className="text-foreground">
                    {fmt(logEntries.filter(e => e.clock_out).reduce((s, e) => s + entrySeconds(e), 0))}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════ ANALYTICS ══════════════════ */}
        <TabsContent value="analytics" className="space-y-6">
          <Tabs defaultValue="weekly-grid" className="space-y-4">
            <TabsList>
              <TabsTrigger value="weekly-grid">Weekly Grid</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              {role === "admin" && <TabsTrigger value="individual">Individual</TabsTrigger>}
            </TabsList>

            {/* Weekly Grid */}
            <TabsContent value="weekly-grid" className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setAnalyticsWeekOffset(w => w - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[200px] text-center">
                  {format(analyticsWeekStart, "MMM d")} – {format(addDays(analyticsWeekStart, 6), "MMM d, yyyy")}
                </span>
                <Button variant="outline" size="sm" onClick={() => setAnalyticsWeekOffset(w => Math.min(0, w + 1))} disabled={analyticsWeekOffset === 0}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" />≥7h</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" />4–7h</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" />&lt;4h</span>
                </div>
              </div>
              <div className="stat-card overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Member</TableHead>
                      {analyticsWeekDays.map(d => (
                        <TableHead key={d} className="text-center text-xs min-w-[56px]">
                          <div>{format(parseISO(d), "EEE")}</div>
                          <div className="font-normal text-muted-foreground">{format(parseISO(d), "M/d")}</div>
                        </TableHead>
                      ))}
                      <TableHead className="text-center text-xs">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map(p => {
                      const daySecs = analyticsWeekDays.map(d => getMemberDaySecs(p.user_id, d));
                      const total = daySecs.reduce((s, m) => s + m, 0);
                      return (
                        <TableRow key={p.user_id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                                {p.full_name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <span className="text-sm font-medium truncate max-w-[100px]">{p.full_name}</span>
                            </div>
                          </TableCell>
                          {daySecs.map((m, i) => (
                            <TableCell key={i} className={cn("text-center text-xs rounded", cellBg(m))}>
                              <span className={cellStyle(m)}>{m > 0 ? `${(m / 3600).toFixed(1)}h` : "—"}</span>
                            </TableCell>
                          ))}
                          <TableCell className="text-center text-xs font-semibold">
                            {total > 0 ? `${(total / 60).toFixed(1)}h` : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Trends */}
            <TabsContent value="trends" className="space-y-6">
              {/* Team daily hours chart */}
              <div className="stat-card">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Team Total Hours — Last 30 Days
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                      formatter={(v: number) => [`${v}h`, "Team Hours"]}
                    />
                    <Line type="monotone" dataKey="hours" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Avg hours per member */}
              <div className="stat-card">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Avg Daily Hours / Member — Last 30 Days
                </h3>
                <ResponsiveContainer width="100%" height={Math.max(teamMembers.length * 32, 120)}>
                  <BarChart data={memberAvgData} layout="vertical" barSize={12} margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 10]} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                      formatter={(v: number) => [`${v}h`, "Avg Hours"]}
                    />
                    <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                      {memberAvgData.map((entry, i) => (
                        <Cell key={i} fill={entry.avg >= 7 ? "hsl(var(--success))" : entry.avg >= 4 ? "hsl(var(--warning))" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Attendance rate */}
              <div className="stat-card">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Attendance Rate — Last 30 Days
                </h3>
                <div className="space-y-3">
                  {memberAttendance.map(({ name, rate }) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-sm min-w-[100px] truncate">{name}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${rate}%`,
                            backgroundColor: rate >= 80 ? "hsl(var(--success))" : rate >= 60 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground min-w-[36px] text-right">{rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Individual */}
            <TabsContent value="individual" className="space-y-6">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select a member…" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedMember && (
                  <>
                    <Button variant="outline" size="sm" onClick={prevMemberMonth}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm font-medium min-w-[110px] text-center">{MONTHS[memberHistMonth]} {memberHistYear}</span>
                    <Button variant="outline" size="sm" onClick={nextMemberMonth}><ChevronRight className="h-4 w-4" /></Button>
                  </>
                )}
              </div>

              {selectedMember && selectedProfile && (
                <div className="space-y-6">
                  {/* Profile */}
                  <div className="stat-card">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                          {selectedProfile.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">{selectedProfile.full_name}</h3>
                          <p className="text-xs text-muted-foreground">{selectedProfile.internal_label || "Team Member"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">All-time: {fmt(allTimeMemberSecs)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        {/* Expected time */}
                        {editingExpected === selectedMember ? (
                          <div className="flex items-center gap-1.5">
                            <Input type="time" value={expectedInput} onChange={e => setExpectedInput(e.target.value)} className="h-8 w-32 text-xs" />
                            <Button size="sm" className="h-8 px-2 text-xs" onClick={() => handleSaveExpected(selectedMember)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingExpected(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            onClick={() => { setEditingExpected(selectedMember); setExpectedInput(selectedProfile.expected_start_time || "09:00"); }}>
                            <Clock className="h-3 w-3" />
                            {selectedProfile.expected_start_time ? `Starts ${selectedProfile.expected_start_time.slice(0, 5)}` : "Set start time"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Monthly summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Days Present", value: memberDaysPresent },
                      { label: "Total Hours", value: fmt(memberTotalSecs) },
                      { label: "Break Time", value: fmt(memberBreakSecs) },
                      { label: "Net Productive", value: fmt(memberNetSecs) },
                    ].map(({ label, value }) => (
                      <div key={label} className="stat-card text-center py-4">
                        <p className="text-xl font-bold">{value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{label}</p>
                      </div>
                    ))}
                  </div>



                  {/* Individual time log */}
                  <div className="stat-card overflow-auto">
                    <h3 className="text-sm font-semibold mb-4">Time Log — {MONTHS[memberHistMonth]} {memberHistYear}</h3>
                    {memberEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No entries for this month.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Clock In</TableHead>
                            <TableHead>Clock Out</TableHead>
                            <TableHead>Gross</TableHead>
                            <TableHead>Break</TableHead>
                            <TableHead>Net</TableHead>
                            <TableHead>Attendance</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {memberEntries.map(e => {
                            const dayBreakSecs = memberBreaks.filter(b => b.date === e.date).reduce((s, b) => s + entrySeconds(b), 0);
                            const netSecs = entrySeconds(e) - dayBreakSecs;
                            const badge = attendanceBadge(e.clock_in, selectedProfile.expected_start_time);
                            const isOvertime = netSecs > 540 * 60;
                            return (
                              <TableRow key={e.id}>
                                <TableCell className="font-medium">{format(parseISO(e.date), "MMM d")}</TableCell>
                                <TableCell>{fmtTime(e.clock_in)}</TableCell>
                                <TableCell>{fmtTime(e.clock_out)}</TableCell>
                                <TableCell>{fmt(e.duration_seconds)}</TableCell>
                                <TableCell>{dayBreakSecs > 0 ? fmt(dayBreakSecs) : "—"}</TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-1.5">
                                    {fmt(netSecs)}
                                    {isOvertime && <AlertTriangle className="h-3 w-3 text-warning" />}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {badge ? <span className={cn("status-badge", badge.cls)}>{badge.label}</span> : <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{e.notes || "—"}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 hover:opacity-100" onClick={() => openEditEntry(e)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              )}

              {!selectedMember && (
                <div className="stat-card text-center py-12">
                  <User className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-sm">Select a team member to view their details.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>


        {/* ══════════════════ CALENDAR ══════════════════ */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setCalMonth(m => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-semibold text-sm min-w-[140px] text-center">{format(calMonth, "MMMM yyyy")}</span>
            <Button variant="outline" size="sm" onClick={() => setCalMonth(m => addMonths(m, 1))} disabled={calMonth >= new Date()}><ChevronRight className="h-4 w-4" /></Button>
            <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-success inline-block" />Full Day</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-warning inline-block" />Partial</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted inline-block border border-border" />No Data</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="stat-card">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Offset for first day */}
              {Array.from({ length: (getDay(startOfMonth(calMonth)) + 6) % 7 }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {calDays.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const isFuture = day > new Date();
                const presence = isFuture ? 0 : getCalDayPresence(dateStr);
                const isSelected = selectedDay === dateStr;
                const maxPresence = teamMembers.length;
                const presenceRate = maxPresence > 0 ? presence / maxPresence : 0;
                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    disabled={isFuture}
                    className={cn(
                      "rounded-lg p-1.5 text-center transition-all border min-h-[52px] flex flex-col items-center justify-start gap-0.5",
                      isToday(day) ? "border-primary" : "border-transparent",
                      isFuture ? "opacity-30 cursor-not-allowed" : "hover:bg-muted/60 cursor-pointer",
                      isSelected ? "bg-primary/10 border-primary" : "",
                      !isSameMonth(day, calMonth) ? "opacity-40" : ""
                    )}
                  >
                    <span className={cn("text-xs font-medium", isToday(day) ? "text-primary" : "")}>
                      {format(day, "d")}
                    </span>
                    {!isFuture && presence > 0 && (
                      <div className="flex flex-wrap gap-0.5 justify-center">
                        <div
                          className="h-1.5 w-10 rounded-full"
                          style={{
                            backgroundColor: presenceRate >= 0.8 ? "hsl(var(--success))" :
                              presenceRate >= 0.4 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                          }}
                        />
                        <span className="text-[9px] text-muted-foreground">{presence}/{maxPresence}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day detail popout */}
          {selectedDay && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">{format(parseISO(selectedDay), "EEEE, MMMM d, yyyy")}</h3>
                <button onClick={() => setSelectedDay(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
              {getCalDayMembers(selectedDay).length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="text-sm">No team members clocked in this day.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getCalDayMembers(selectedDay).map(({ entry, profile, breakSecs }) => {
                    const netSecs = entrySeconds(entry) - breakSecs;
                    const badge = attendanceBadge(entry.clock_in, profile?.expected_start_time);
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{profile?.full_name || "Unknown"}</p>
                            {badge && <span className={cn("status-badge", badge.cls)}>{badge.label}</span>}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{fmtTime(entry.clock_in)} → {entry.clock_out ? fmtTime(entry.clock_out) : "Active"}</p>
                          <p>Net: <strong className="text-foreground">{fmt(netSecs)}</strong>{breakSecs > 0 ? ` (${fmt(breakSecs)} break)` : ""}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
