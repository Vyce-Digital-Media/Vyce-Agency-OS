import { useEffect, useState, useMemo } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import DeliverableDetailSheet, { DeliverableForSheet } from "@/components/DeliverableDetailSheet";
import {
  Plus, FileText, Search, Flag, Calendar, User, AlertTriangle,
  Clock, CheckCircle, ChevronRight,
} from "lucide-react";

interface Profile {
  user_id: string;
  full_name: string;
  internal_label: string | null;
}

interface Deliverable extends DeliverableForSheet {}

interface Plan {
  id: string;
  month: number;
  year: number;
  clients: { name: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  post: "Post", reel: "Reel", story: "Story", ad: "Ad",
  campaign: "Campaign", blog: "Blog", newsletter: "Newsletter", other: "Other",
};

const STATUS_FLOW = ["not_started", "in_progress", "in_review", "needs_approval", "approved", "delivered"];

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", in_review: "In Review",
  needs_approval: "Needs Approval", approved: "Approved", delivered: "Delivered",
};

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  in_review: "bg-yellow-500/10 text-yellow-600",
  needs_approval: "bg-orange-500/10 text-orange-600",
  approved: "bg-green-500/10 text-green-600",
  delivered: "bg-accent/10 text-accent-foreground",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-green-500/10 text-green-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  high: "bg-red-500/10 text-red-600",
  urgent: "bg-purple-500/10 text-purple-600",
};

const PRIORITY_LEFT_STRIP: Record<string, string> = {
  low: "bg-green-500",
  medium: "bg-yellow-500",
  high: "bg-red-500",
  urgent: "bg-purple-500",
};

const PRIORITY_LABELS: Record<string, string> = { low: "Low", medium: "Med", high: "High", urgent: "Urgent" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Smart view definitions
type ViewId = "all" | "needs_approval" | "overdue" | "in_progress" | "my_tasks" | "completed";

export default function Deliverables() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [activeView, setActiveView] = useState<ViewId>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "", description: "", type: "post", plan_id: "",
    due_date: "", assigned_to: "", priority: "medium",
  });
  const { role, user } = useAuth();
  const { toast } = useToast();
  const canManage = role === "admin" || role === "manager";

  const fetchData = async () => {
    const query = backend
      .from("deliverables")
      .select("*, monthly_plans(month, year, clients(name, brand_color))")
      .order("due_date", { ascending: true, nullsFirst: false });

    const [delRes, plansRes, profilesRes] = await Promise.all([
      query,
      backend.from("monthly_plans").select("id, month, year, clients(name)").in("status", ["draft", "active"]),
      backend.rpc("get_team_directory" as any),
    ]);
    if (delRes.data) setDeliverables(delRes.data as unknown as Deliverable[]);
    if (plansRes.data) setPlans(plansRes.data as unknown as Plan[]);
    if (profilesRes.data) setTeamMembers(profilesRes.data as Profile[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-set view for team members
  useEffect(() => {
    if (role === "team_member") setActiveView("my_tasks");
  }, [role]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await backend.from("deliverables").insert({
      title: formData.title,
      description: formData.description || null,
      type: formData.type as any,
      plan_id: formData.plan_id,
      due_date: formData.due_date || null,
      assigned_to: formData.assigned_to || null,
      priority: formData.priority,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deliverable added" });
      setDialogOpen(false);
      setFormData({ title: "", description: "", type: "post", plan_id: "", due_date: "", assigned_to: "", priority: "medium" });
      fetchData();
    }
  };

  // Smart view filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const viewFiltered = useMemo(() => {
    return deliverables.filter(d => {
      if (activeView === "my_tasks") return d.assigned_to === user?.id && d.status !== "delivered" && d.status !== "approved";
      if (activeView === "needs_approval") return d.status === "needs_approval";
      if (activeView === "overdue") {
        if (!d.due_date) return false;
        return new Date(d.due_date) < today && d.status !== "delivered" && d.status !== "approved";
      }
      if (activeView === "in_progress") return d.status === "in_progress" || d.status === "in_review";
      if (activeView === "completed") return d.status === "approved" || d.status === "delivered";
      return true;
    });
  }, [deliverables, activeView, user?.id]);

  const filtered = useMemo(() => {
    return viewFiltered.filter(d => {
      const matchSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
        (d.monthly_plans?.clients?.name || "").toLowerCase().includes(search.toLowerCase());
      const matchPriority = filterPriority === "all" || d.priority === filterPriority;
      const matchClient = filterClient === "all" || d.monthly_plans?.clients?.name === filterClient;
      const matchAssignee = filterAssignee === "all"
        || (filterAssignee === "unassigned" ? !d.assigned_to : d.assigned_to === filterAssignee);
      return matchSearch && matchPriority && matchClient && matchAssignee;
    });
  }, [viewFiltered, search, filterPriority, filterClient, filterAssignee]);

  // Active task counts per assignee (excludes approved/delivered)
  const assigneeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let unassigned = 0;
    deliverables.forEach(d => {
      if (d.status === "approved" || d.status === "delivered") return;
      if (!d.assigned_to) unassigned++;
      else counts[d.assigned_to] = (counts[d.assigned_to] || 0) + 1;
    });
    return { counts, unassigned };
  }, [deliverables]);

  // Tab counts
  const counts = useMemo(() => ({
    needs_approval: deliverables.filter(d => d.status === "needs_approval").length,
    overdue: deliverables.filter(d => {
      if (!d.due_date) return false;
      return new Date(d.due_date) < today && d.status !== "delivered" && d.status !== "approved";
    }).length,
    my_tasks: deliverables.filter(d => d.assigned_to === user?.id && d.status !== "delivered" && d.status !== "approved").length,
  }), [deliverables, user?.id]);

  const clientNames = useMemo(() => {
    const names = new Set(deliverables.map(d => d.monthly_plans?.clients?.name).filter(Boolean) as string[]);
    return Array.from(names);
  }, [deliverables]);

  const getDueDateDisplay = (dueDate: string | null) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, cls: "text-red-500 font-medium" };
    if (diffDays === 0) return { label: "Due today", cls: "text-orange-500 font-medium" };
    if (diffDays <= 2) return { label: `Due in ${diffDays}d`, cls: "text-yellow-600 font-medium" };
    return { label: MONTHS[due.getMonth()] + " " + due.getDate(), cls: "text-muted-foreground" };
  };

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return null;
    const m = teamMembers.find(m => m.user_id === userId);
    return m?.full_name || "Unknown";
  };

  const openSheet = (d: Deliverable) => {
    setSelectedDeliverable(d);
    setSheetOpen(true);
  };

  const handleSheetRefresh = () => {
    fetchData().then(() => {
      // Re-select the updated deliverable
      if (selectedDeliverable) {
        setDeliverables(prev => {
          const updated = prev.find(d => d.id === selectedDeliverable.id);
          if (updated) setSelectedDeliverable(updated);
          return prev;
        });
      }
    });
  };

  // After fetch, sync selected deliverable
  useEffect(() => {
    if (selectedDeliverable && sheetOpen) {
      const updated = deliverables.find(d => d.id === selectedDeliverable.id);
      if (updated) setSelectedDeliverable(updated);
    }
  }, [deliverables]);

  const adminViews: { id: ViewId; label: string; icon?: React.ReactNode }[] = [
    { id: "all", label: "All" },
    { id: "needs_approval", label: "Needs Approval", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
    { id: "overdue", label: "Overdue", icon: <Clock className="h-3.5 w-3.5" /> },
    { id: "in_progress", label: "In Progress" },
    { id: "my_tasks", label: "My Tasks" },
    { id: "completed", label: "Completed", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  ];

  const memberViews: { id: ViewId; label: string; icon?: React.ReactNode }[] = [
    { id: "my_tasks", label: "My Tasks" },
    { id: "completed", label: "Completed" },
  ];

  const views = canManage ? adminViews : memberViews;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {canManage ? "Track, assign, and approve all deliverables." : "Your assigned tasks across all clients."}
          </p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Deliverable</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Deliverable</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Instagram Carousel Post" required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2} placeholder="Brief description..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={v => setFormData({...formData, priority: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">🟢 Low</SelectItem>
                        <SelectItem value="medium">🟡 Medium</SelectItem>
                        <SelectItem value="high">🔴 High</SelectItem>
                        <SelectItem value="urgent">🟣 Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Plan *</Label>
                    <Select value={formData.plan_id} onValueChange={v => setFormData({...formData, plan_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                      <SelectContent>
                        {plans.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.clients?.name} — {MONTHS[p.month - 1]} {p.year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select value={formData.assigned_to} onValueChange={v => setFormData({...formData, assigned_to: v === "unassigned" ? "" : v})}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {teamMembers.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name}{m.internal_label ? ` (${m.internal_label})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={!formData.plan_id}>Add Deliverable</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {views.map(v => {
          const count = v.id === "needs_approval" ? counts.needs_approval
            : v.id === "overdue" ? counts.overdue
            : v.id === "my_tasks" ? counts.my_tasks
            : null;
          const isActive = activeView === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {v.icon}
              {v.label}
              {count != null && count > 0 && (
                <span className={`ml-0.5 text-xs px-1.5 py-0 rounded-full font-semibold ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : 
                  v.id === "needs_approval" ? "bg-orange-500/20 text-orange-600" :
                  v.id === "overdue" ? "bg-red-500/20 text-red-600" :
                  "bg-muted text-muted-foreground"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deliverables..." className="pl-9 h-9" />
        </div>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <Flag className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="urgent">🟣 Urgent</SelectItem>
            <SelectItem value="high">🔴 High</SelectItem>
            <SelectItem value="medium">🟡 Medium</SelectItem>
            <SelectItem value="low">🟢 Low</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clientNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {canManage && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">
                Unassigned {assigneeCounts.unassigned > 0 && `(${assigneeCounts.unassigned})`}
              </SelectItem>
              {teamMembers.map(m => {
                const c = assigneeCounts.counts[m.user_id] || 0;
                return (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name} {c > 0 && `(${c})`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <h3 className="text-base font-semibold mb-1">No deliverables found</h3>
          <p className="text-muted-foreground text-sm">
            {activeView === "needs_approval" ? "No deliverables are waiting for approval." :
             activeView === "overdue" ? "No overdue deliverables. Great work!" :
             activeView === "my_tasks" ? "You have no active tasks assigned to you." :
             "No deliverables match your filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(d => {
            const dueDateInfo = getDueDateDisplay(d.due_date);
            const assigneeName = getAssigneeName(d.assigned_to);
            const initials = assigneeName ? assigneeName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) : null;
            const brandColor = d.monthly_plans?.clients?.brand_color || "#3B82F6";
            const isOwner = d.assigned_to === user?.id;

            return (
              <div
                key={d.id}
                className="stat-card flex items-center gap-0 p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => openSheet(d)}
              >
                {/* Priority color strip */}
                <div className={`w-1 self-stretch shrink-0 ${PRIORITY_LEFT_STRIP[d.priority]}`} />

                <div className="flex items-center gap-4 flex-1 p-4 min-w-0">
                  {/* Client color dot + type */}
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: brandColor }}
                  >
                    {TYPE_LABELS[d.type]?.charAt(0) || "?"}
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{d.title}</p>
                      {d.status === "needs_approval" && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
                          <AlertTriangle className="h-2.5 w-2.5" /> Needs Approval
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {canManage && <span className="font-medium text-foreground/70">{d.monthly_plans?.clients?.name}</span>}
                      {canManage && <span>·</span>}
                      <span>{TYPE_LABELS[d.type]}</span>
                      {dueDateInfo && (
                        <>
                          <span>·</span>
                          <span className={`flex items-center gap-1 ${dueDateInfo.cls}`}>
                            <Calendar className="h-3 w-3" />
                            {dueDateInfo.label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right side metadata */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Priority badge */}
                    <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[d.priority]}`}>
                      <Flag className="h-2.5 w-2.5" />
                      {PRIORITY_LABELS[d.priority]}
                    </span>

                    {/* Assignee avatar */}
                    {initials && (
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: brandColor }}
                        title={assigneeName || ""}
                      >
                        {initials}
                      </div>
                    )}

                    {/* Status badge */}
                    <span className={`status-badge text-xs ${STATUS_STYLES[d.status]}`}>
                      {STATUS_LABELS[d.status]}
                    </span>

                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <DeliverableDetailSheet
        deliverable={selectedDeliverable}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedDeliverable(null); }}
        onRefresh={handleSheetRefresh}
        teamMembers={teamMembers}
        canManage={canManage}
      />
    </div>
  );
}
