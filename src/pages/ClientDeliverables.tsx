import { useEffect, useState } from "react";
import { backend } from "@/integrations/backend/client";
import { FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  description: string | null;
  monthly_plans: {
    month: number;
    year: number;
    clients: { name: string; brand_color: string } | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started", in_progress: "In Progress", in_review: "In Review",
  approved: "Approved", delivered: "Delivered",
};
const STATUS_STYLES: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground", in_progress: "bg-primary/10 text-primary",
  in_review: "bg-warning/10 text-warning", approved: "bg-success/10 text-success",
  delivered: "bg-accent/10 text-accent",
};
const TYPE_LABELS: Record<string, string> = {
  post: "Post", reel: "Reel", story: "Story", ad: "Ad",
  campaign: "Campaign", blog: "Blog", newsletter: "Newsletter", other: "Other",
};
const STATUS_FLOW = ["not_started", "in_progress", "in_review", "approved", "delivered"];

export default function ClientDeliverables() {
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    backend
      .from("deliverables")
      .select("*, monthly_plans(month, year, clients(name, brand_color))")
      .order("due_date", { ascending: true })
      .then(({ data }) => {
        if (data) setDeliverables(data as unknown as Deliverable[]);
        setLoading(false);
      });
  }, []);

  const filtered = deliverables.filter((d) => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || d.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Deliverables</h1>
        <p className="text-muted-foreground mt-1">View all your deliverables and their current status.</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_FLOW.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">No deliverables found.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((d) => (
            <div key={d.id} className="stat-card flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0"
                  style={{ backgroundColor: d.monthly_plans?.clients?.brand_color || "#3B82F6" }}
                >
                  {TYPE_LABELS[d.type]?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{d.title}</p>
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
  );
}
