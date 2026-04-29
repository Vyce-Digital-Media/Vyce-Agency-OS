import { useEffect, useState } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Calendar, CheckCircle2, Clock, Eye } from "lucide-react";

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  description: string | null;
  plan_id: string;
  monthly_plans: {
    month: number;
    year: number;
    clients: { name: string; brand_color: string } | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  in_review: "In Review",
  approved: "Approved",
  delivered: "Delivered",
};

const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary",
  in_review: "bg-warning/10 text-warning",
  approved: "bg-success/10 text-success",
  delivered: "bg-accent/10 text-accent",
};

const TYPE_LABELS: Record<string, string> = {
  post: "Post", reel: "Reel", story: "Story", ad: "Ad",
  campaign: "Campaign", blog: "Blog", newsletter: "Newsletter", other: "Other",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ClientPortal() {
  const { profile } = useAuth();
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await backend
        .from("deliverables")
        .select("*, monthly_plans(month, year, clients(name, brand_color))")
        .order("due_date", { ascending: true });
      if (data) setDeliverables(data as unknown as Deliverable[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const pending = deliverables.filter((d) => d.status !== "approved" && d.status !== "delivered");
  const completed = deliverables.filter((d) => d.status === "approved" || d.status === "delivered");
  const inReview = deliverables.filter((d) => d.status === "in_review");
  const upcoming = pending.filter((d) => d.due_date && d.due_date >= today).slice(0, 8);

  if (loading) {
    return (
      <div className="animate-fade-in p-8">
        <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">Here's the latest on your deliverables.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Deliverables</span>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold">{deliverables.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Awaiting Review</span>
            <Eye className="h-4 w-4 text-warning" />
          </div>
          <p className="text-3xl font-bold">{inReview.length}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <p className="text-3xl font-bold">{completed.length}</p>
        </div>
      </div>

      {/* Upcoming deliverables */}
      {upcoming.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Upcoming
          </h2>
          <div className="stat-card p-2 space-y-0.5">
            {upcoming.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-7 w-7 rounded flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                    style={{ backgroundColor: d.monthly_plans?.clients?.brand_color || "#3B82F6" }}
                  >
                    {TYPE_LABELS[d.type]?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.monthly_plans?.clients?.name} · {TYPE_LABELS[d.type]}
                      {d.due_date && ` · Due ${d.due_date}`}
                    </p>
                  </div>
                </div>
                <span className={`status-badge text-[10px] ${STATUS_STYLES[d.status]}`}>
                  {STATUS_LABELS[d.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All deliverables by status */}
      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> All Deliverables
        </h2>
        {deliverables.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">No deliverables yet</h3>
            <p className="text-muted-foreground text-sm">Your deliverables will appear here once created.</p>
          </div>
        ) : (
          <div className="stat-card p-2 space-y-0.5">
            {deliverables.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="h-7 w-7 rounded flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                    style={{ backgroundColor: d.monthly_plans?.clients?.brand_color || "#3B82F6" }}
                  >
                    {TYPE_LABELS[d.type]?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.monthly_plans?.clients?.name} · {TYPE_LABELS[d.type]}
                      {d.due_date && ` · Due ${d.due_date}`}
                    </p>
                  </div>
                </div>
                <span className={`status-badge text-[10px] ${STATUS_STYLES[d.status]}`}>
                  {STATUS_LABELS[d.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
