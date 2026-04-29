import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, CalendarRange } from "lucide-react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import PlanDetailSheet, { Plan } from "@/components/PlanDetailSheet";

// ── Constants ────────────────────────────────────────────────────────────────

const PLAN_TYPES = [
  { value: "social_media", label: "Social Media Management" },
  { value: "website_development", label: "Website Development" },
  { value: "content_marketing", label: "Content Marketing" },
  { value: "branding", label: "Branding" },
  { value: "other", label: "Other" },
];

const PLAN_TYPE_LABELS: Record<string, string> = {
  social_media: "Social Media",
  website_development: "Website Dev",
  content_marketing: "Content",
  branding: "Branding",
  other: "Other",
};

const PLAN_TYPE_COLORS: Record<string, string> = {
  social_media: "bg-purple-500/10 text-purple-600",
  website_development: "bg-blue-500/10 text-blue-600",
  content_marketing: "bg-amber-500/10 text-amber-600",
  branding: "bg-rose-500/10 text-rose-600",
  other: "bg-muted text-muted-foreground",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary",
  completed: "bg-green-500/10 text-green-600",
  archived: "bg-muted text-muted-foreground",
};

const STATUS_FILTERS = ["all", "draft", "active", "completed", "archived"];

// ── Deliverables summary helper ──────────────────────────────────────────────

function getDeliverablesSummary(planType: string, breakdown: Record<string, unknown> | null): string {
  if (!breakdown) return "";
  if (planType === "social_media") {
    const parts = [];
    if (breakdown.posts) parts.push(`${breakdown.posts} posts`);
    if (breakdown.reels) parts.push(`${breakdown.reels} reels`);
    if (breakdown.stories) parts.push(`${breakdown.stories} stories`);
    return parts.join(" · ");
  }
  if (planType === "website_development") {
    const parts = [];
    if (breakdown.pages) parts.push(`${breakdown.pages} pages`);
    if (breakdown.site_type) parts.push(String(breakdown.site_type));
    if (breakdown.duration_weeks) parts.push(`${breakdown.duration_weeks}w`);
    return parts.join(" · ");
  }
  if (planType === "content_marketing") {
    const parts = [];
    if (breakdown.blogs) parts.push(`${breakdown.blogs} blogs`);
    if (breakdown.newsletters) parts.push(`${breakdown.newsletters} newsletters`);
    if (breakdown.case_studies) parts.push(`${breakdown.case_studies} case studies`);
    return parts.join(" · ");
  }
  if (planType === "branding") {
    const items = ["logo", "brand_guidelines", "social_media_kit", "pitch_deck"].filter((k) => breakdown[k]);
    return items.map((k) => k.replace(/_/g, " ")).join(" · ");
  }
  return "";
}

// ── Date picker helper ───────────────────────────────────────────────────────

function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd MMM yyyy") : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[200]" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Dynamic form sections (for creation dialog) ──────────────────────────────

function SocialMediaForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const platforms = ["Instagram", "Facebook", "LinkedIn", "Twitter/X"];
  const active: string[] = Array.isArray(data.platforms) ? (data.platforms as string[]) : [];
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const toggle = (p: string) => {
    const next = active.includes(p) ? active.filter((x) => x !== p) : [...active, p];
    set("platforms", next);
  };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(["posts", "reels", "stories"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <Label className="capitalize text-xs">{k}</Label>
            <Input type="number" min="0" value={Number(data[k] ?? 0)} onChange={(e) => set(k, parseInt(e.target.value) || 0)} />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Platforms</Label>
        <div className="flex flex-wrap gap-3">
          {platforms.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <Checkbox id={`cp-${p}`} checked={active.includes(p)} onCheckedChange={() => toggle(p)} />
              <label htmlFor={`cp-${p}`} className="text-sm cursor-pointer">{p}</label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WebsiteForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="space-y-3">
      <div className="flex gap-6">
        {(["ui_ux", "seo_setup"] as const).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <Checkbox id={`cw-${k}`} checked={Boolean(data[k])} onCheckedChange={(v) => set(k, v)} />
            <label htmlFor={`cw-${k}`} className="text-sm cursor-pointer">{k === "ui_ux" ? "UI/UX Design" : "SEO Setup"}</label>
          </div>
        ))}
      </div>
      <Select value={String(data.site_type ?? "static")} onValueChange={(v) => set("site_type", v)}>
        <SelectTrigger><SelectValue placeholder="Site type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="static">Static</SelectItem>
          <SelectItem value="ecommerce">E-commerce</SelectItem>
          <SelectItem value="webapp">Web App</SelectItem>
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Pages</Label>
          <Input type="number" min="0" value={Number(data.pages ?? 0)} onChange={(e) => set("pages", parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Duration (weeks)</Label>
          <Input type="number" min="0" value={Number(data.duration_weeks ?? 0)} onChange={(e) => set("duration_weeks", parseInt(e.target.value) || 0)} />
        </div>
      </div>
    </div>
  );
}

function ContentForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["blogs", "newsletters", "case_studies"] as const).map((k) => (
        <div key={k} className="space-y-1">
          <Label className="capitalize text-xs">{k.replace("_", " ")}</Label>
          <Input type="number" min="0" value={Number(data[k] ?? 0)} onChange={(e) => set(k, parseInt(e.target.value) || 0)} />
        </div>
      ))}
    </div>
  );
}

function BrandingForm({ data, onChange }: { data: Record<string, unknown>; onChange: (d: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...data, [k]: v });
  const items = [
    { key: "logo", label: "Logo Design" },
    { key: "brand_guidelines", label: "Brand Guidelines" },
    { key: "social_media_kit", label: "Social Media Kit" },
    { key: "pitch_deck", label: "Pitch Deck" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5">
          <Checkbox id={`cb-${key}`} checked={Boolean(data[key])} onCheckedChange={(v) => set(key, v)} />
          <label htmlFor={`cb-${key}`} className="text-sm cursor-pointer">{label}</label>
        </div>
      ))}
    </div>
  );
}

function computeTotal(planType: string, breakdown: Record<string, unknown>): number {
  if (planType === "social_media") return Number(breakdown.posts ?? 0) + Number(breakdown.reels ?? 0) + Number(breakdown.stories ?? 0);
  if (planType === "website_development") return Number(breakdown.pages ?? 1);
  if (planType === "content_marketing") return Number(breakdown.blogs ?? 0) + Number(breakdown.newsletters ?? 0) + Number(breakdown.case_studies ?? 0);
  if (planType === "branding") return ["logo", "brand_guidelines", "social_media_kit", "pitch_deck"].filter((k) => Boolean(breakdown[k])).length;
  return 1;
}

// ── Main page ────────────────────────────────────────────────────────────────

interface Client { id: string; name: string; brand_color: string | null }

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Form state
  const [formClientId, setFormClientId] = useState("");
  const [formPlanType, setFormPlanType] = useState("social_media");
  const [formStartDate, setFormStartDate] = useState<Date | undefined>();
  const [formEndDate, setFormEndDate] = useState<Date | undefined>();
  const [formDescription, setFormDescription] = useState("");
  const [formBreakdown, setFormBreakdown] = useState<Record<string, unknown>>({});

  const { role } = useAuth();
  const { toast } = useToast();
  const canManage = role === "admin" || role === "manager";

  const fetchData = async () => {
    const [plansRes, clientsRes] = await Promise.all([
      backend.from("monthly_plans").select("*, clients(name, brand_color)").order("start_date", { ascending: false }),
      backend.from("clients").select("id, name, brand_color").eq("is_active", true),
    ]);
    if (plansRes.data) setPlans(plansRes.data as unknown as Plan[]);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setFormClientId(""); setFormPlanType("social_media");
    setFormStartDate(undefined); setFormEndDate(undefined);
    setFormDescription(""); setFormBreakdown({});
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId || !formStartDate) {
      toast({ title: "Please select a client and start date", variant: "destructive" });
      return;
    }
    const total = computeTotal(formPlanType, formBreakdown);
    const { error } = await backend.from("monthly_plans").insert({
      client_id: formClientId,
      plan_type: formPlanType,
      start_date: format(formStartDate, "yyyy-MM-dd"),
      end_date: formEndDate ? format(formEndDate, "yyyy-MM-dd") : null,
      description: formDescription || null,
      deliverables_breakdown: formBreakdown as Record<string, string | number | boolean | null>,
      total_deliverables: total,
      month: formStartDate.getMonth() + 1,
      year: formStartDate.getFullYear(),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plan created!" });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
  };

  const filteredPlans = plans.filter((p) => {
    const statusOk = statusFilter === "all" || p.status === statusFilter;
    const typeOk = typeFilter === "all" || p.plan_type === typeFilter;
    return statusOk && typeOk;
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Monthly Plans</h1>
          <p className="text-muted-foreground mt-1 text-sm">Define and track service commitments per client.</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Plan</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Monthly Plan</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                {/* Client */}
                <div className="space-y-1">
                  <Label>Client *</Label>
                  <Select value={formClientId} onValueChange={setFormClientId}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Plan type */}
                <div className="space-y-1">
                  <Label>Plan Type *</Label>
                  <Select value={formPlanType} onValueChange={(v) => { setFormPlanType(v); setFormBreakdown({}); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLAN_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <DatePicker label="Start Date *" value={formStartDate} onChange={setFormStartDate} />
                  <DatePicker label="End Date" value={formEndDate} onChange={setFormEndDate} />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label>Description / Notes</Label>
                  <Textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional plan description..."
                  />
                </div>

                {/* Dynamic breakdown */}
                {formPlanType !== "other" && (
                  <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Deliverables Breakdown
                    </Label>
                    {formPlanType === "social_media" && <SocialMediaForm data={formBreakdown} onChange={setFormBreakdown} />}
                    {formPlanType === "website_development" && <WebsiteForm data={formBreakdown} onChange={setFormBreakdown} />}
                    {formPlanType === "content_marketing" && <ContentForm data={formBreakdown} onChange={setFormBreakdown} />}
                    {formPlanType === "branding" && <BrandingForm data={formBreakdown} onChange={setFormBreakdown} />}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={!formClientId || !formStartDate}>
                  Create Plan
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors border",
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="w-px bg-border mx-1 self-stretch" />
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "All Types" }, ...PLAN_TYPES.map((t) => ({ value: t.value, label: PLAN_TYPE_LABELS[t.value] }))].map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium transition-colors border",
                typeFilter === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-28" />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <CalendarRange className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">No plans found</h3>
          <p className="text-muted-foreground text-sm">
            {plans.length === 0 ? "Create a monthly plan for a client to start tracking." : "Try changing your filters."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredPlans.map((plan) => {
            const summary = getDeliverablesSummary(plan.plan_type, plan.deliverables_breakdown);
            const brandColor = plan.clients?.brand_color ?? "#3B82F6";
            const dateRange = plan.start_date
              ? `${format(new Date(plan.start_date), "dd MMM")}${plan.end_date ? ` – ${format(new Date(plan.end_date), "dd MMM yyyy")}` : `, ${new Date(plan.start_date).getFullYear()}`}`
              : null;

            return (
              <div
                key={plan.id}
                className="stat-card cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => { setSelectedPlan(plan); setSheetOpen(true); }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: brandColor }}
                    >
                      {plan.clients?.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{plan.clients?.name ?? "Unknown Client"}</p>
                      {dateRange && (
                        <p className="text-xs text-muted-foreground mt-0.5">{dateRange}</p>
                      )}
                    </div>
                  </div>
                  <span className={`status-badge capitalize shrink-0 ${STATUS_STYLES[plan.status] ?? ""}`}>
                    {plan.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className={cn("text-xs", PLAN_TYPE_COLORS[plan.plan_type])}>
                    {PLAN_TYPE_LABELS[plan.plan_type] ?? plan.plan_type}
                  </Badge>
                  {summary && (
                    <span className="text-xs text-muted-foreground">{summary}</span>
                  )}
                </div>

                {plan.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{plan.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <PlanDetailSheet
        plan={selectedPlan}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={fetchData}
      />
    </div>
  );
}
