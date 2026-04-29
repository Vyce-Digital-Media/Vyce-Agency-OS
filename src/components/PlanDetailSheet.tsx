import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Trash2, Save } from "lucide-react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PLAN_TYPE_LABELS: Record<string, string> = {
  social_media: "Social Media",
  website_development: "Website Dev",
  content_marketing: "Content Marketing",
  branding: "Branding",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary",
  completed: "bg-green-500/10 text-green-600",
  archived: "bg-muted text-muted-foreground",
};

export interface Plan {
  id: string;
  client_id: string;
  month: number;
  year: number;
  total_deliverables: number;
  status: string;
  notes: string | null;
  plan_type: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  deliverables_breakdown: Record<string, unknown> | null;
  clients: { name: string; brand_color: string | null } | null;
}

interface Props {
  plan: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

// ── Dynamic breakdown sections ──────────────────────────────────────────────

function SocialMediaBreakdown({
  data,
  onChange,
  readOnly,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const n = (key: string) => Number(data[key] ?? 0);
  const platforms = ["Instagram", "Facebook", "LinkedIn", "Twitter/X"];
  const activePlatforms: string[] = Array.isArray(data.platforms) ? (data.platforms as string[]) : [];

  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const togglePlatform = (p: string) => {
    const next = activePlatforms.includes(p) ? activePlatforms.filter((x) => x !== p) : [...activePlatforms, p];
    set("platforms", next);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(["posts", "reels", "stories"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <Label className="capitalize text-xs">{k}</Label>
            <Input
              type="number"
              min="0"
              value={n(k)}
              disabled={readOnly}
              onChange={(e) => set(k, parseInt(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Platforms</Label>
        <div className="flex flex-wrap gap-3">
          {platforms.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <Checkbox
                id={`plat-${p}`}
                checked={activePlatforms.includes(p)}
                onCheckedChange={() => !readOnly && togglePlatform(p)}
                disabled={readOnly}
              />
              <label htmlFor={`plat-${p}`} className="text-sm cursor-pointer">{p}</label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WebsiteBreakdown({
  data,
  onChange,
  readOnly,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });

  return (
    <div className="space-y-4">
      <div className="flex gap-6">
        {(["ui_ux", "seo_setup"] as const).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <Checkbox
              id={k}
              checked={Boolean(data[k])}
              onCheckedChange={(v) => !readOnly && set(k, v)}
              disabled={readOnly}
            />
            <label htmlFor={k} className="text-sm cursor-pointer">
              {k === "ui_ux" ? "UI/UX Design" : "SEO Setup"}
            </label>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Site Type</Label>
        <Select
          value={String(data.site_type ?? "static")}
          onValueChange={(v) => set("site_type", v)}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Static</SelectItem>
            <SelectItem value="ecommerce">E-commerce</SelectItem>
            <SelectItem value="webapp">Web App</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Total Pages</Label>
          <Input
            type="number"
            min="0"
            value={Number(data.pages ?? 0)}
            disabled={readOnly}
            onChange={(e) => set("pages", parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Duration (weeks)</Label>
          <Input
            type="number"
            min="0"
            value={Number(data.duration_weeks ?? 0)}
            disabled={readOnly}
            onChange={(e) => set("duration_weeks", parseInt(e.target.value) || 0)}
          />
        </div>
      </div>
    </div>
  );
}

function ContentMarketingBreakdown({
  data,
  onChange,
  readOnly,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  return (
    <div className="grid grid-cols-3 gap-3">
      {(["blogs", "newsletters", "case_studies"] as const).map((k) => (
        <div key={k} className="space-y-1">
          <Label className="capitalize text-xs">{k.replace("_", " ")}</Label>
          <Input
            type="number"
            min="0"
            value={Number(data[k] ?? 0)}
            disabled={readOnly}
            onChange={(e) => set(k, parseInt(e.target.value) || 0)}
          />
        </div>
      ))}
    </div>
  );
}

function BrandingBreakdown({
  data,
  onChange,
  readOnly,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const set = (key: string, val: unknown) => onChange({ ...data, [key]: val });
  const items = [
    { key: "logo", label: "Logo Design" },
    { key: "brand_guidelines", label: "Brand Guidelines" },
    { key: "social_media_kit", label: "Social Media Kit" },
    { key: "pitch_deck", label: "Pitch Deck" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5">
          <Checkbox
            id={key}
            checked={Boolean(data[key])}
            onCheckedChange={(v) => !readOnly && set(key, v)}
            disabled={readOnly}
          />
          <label htmlFor={key} className="text-sm cursor-pointer">{label}</label>
        </div>
      ))}
    </div>
  );
}

// ── compute total_deliverables from breakdown ────────────────────────────────
function computeTotal(planType: string, breakdown: Record<string, unknown>): number {
  if (planType === "social_media") {
    return (Number(breakdown.posts ?? 0) + Number(breakdown.reels ?? 0) + Number(breakdown.stories ?? 0));
  }
  if (planType === "website_development") return Number(breakdown.pages ?? 1);
  if (planType === "content_marketing") {
    return Number(breakdown.blogs ?? 0) + Number(breakdown.newsletters ?? 0) + Number(breakdown.case_studies ?? 0);
  }
  if (planType === "branding") {
    return ["logo", "brand_guidelines", "social_media_kit", "pitch_deck"].filter((k) => Boolean(breakdown[k])).length;
  }
  return 1;
}

// ── Date picker helper ───────────────────────────────────────────────────────
function DatePicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
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

// ── Main component ───────────────────────────────────────────────────────────
export default function PlanDetailSheet({ plan, open, onOpenChange, onUpdated }: Props) {
  const { role } = useAuth();
  const { toast } = useToast();
  const canEdit = role === "admin" || role === "manager";
  const isAdmin = role === "admin";

  const [status, setStatus] = useState("draft");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [description, setDescription] = useState("");
  const [breakdown, setBreakdown] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!plan) return;
    setStatus(plan.status);
    setStartDate(plan.start_date ? new Date(plan.start_date) : undefined);
    setEndDate(plan.end_date ? new Date(plan.end_date) : undefined);
    setDescription(plan.description ?? "");
    setBreakdown((plan.deliverables_breakdown as Record<string, unknown>) ?? {});
  }, [plan]);

  if (!plan) return null;

  const handleSave = async () => {
    setSaving(true);
    const total = computeTotal(plan.plan_type, breakdown);
    const sd = startDate ?? new Date();
    const { error } = await backend
      .from("monthly_plans")
      .update({
        status,
        start_date: startDate ? format(startDate, "yyyy-MM-dd") : null,
        end_date: endDate ? format(endDate, "yyyy-MM-dd") : null,
        description,
        deliverables_breakdown: breakdown as Record<string, string | number | boolean | null>,
        total_deliverables: total,
        month: sd.getMonth() + 1,
        year: sd.getFullYear(),
      })
      .eq("id", plan.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plan updated" });
      onUpdated();
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    const { error } = await backend.from("monthly_plans").delete().eq("id", plan.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plan deleted" });
      onUpdated();
      onOpenChange(false);
    }
  };

  const brandColor = plan.clients?.brand_color ?? "#3B82F6";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          {/* Client avatar + name */}
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: brandColor }}
            >
              {plan.clients?.name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div>
              <SheetTitle className="text-base">{plan.clients?.name ?? "Unknown Client"}</SheetTitle>
              <Badge variant="outline" className="text-xs mt-0.5">
                {PLAN_TYPE_LABELS[plan.plan_type] ?? plan.plan_type}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5">
          {/* Status */}
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            {canEdit ? (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["draft", "active", "completed", "archived"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className={`status-badge capitalize ${STATUS_STYLES[status] ?? ""}`}>{status}</span>
            )}
          </div>

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <DatePicker label="Start Date" value={startDate} onChange={setStartDate} disabled={!canEdit} />
            <DatePicker label="End Date" value={endDate} onChange={setEndDate} disabled={!canEdit} />
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">Description / Notes</Label>
            <Textarea
              rows={3}
              value={description}
              disabled={!canEdit}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add plan notes or objectives..."
            />
          </div>

          <Separator />

          {/* Dynamic breakdown */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deliverables Breakdown
            </Label>
            {plan.plan_type === "social_media" && (
              <SocialMediaBreakdown data={breakdown} onChange={setBreakdown} readOnly={!canEdit} />
            )}
            {plan.plan_type === "website_development" && (
              <WebsiteBreakdown data={breakdown} onChange={setBreakdown} readOnly={!canEdit} />
            )}
            {plan.plan_type === "content_marketing" && (
              <ContentMarketingBreakdown data={breakdown} onChange={setBreakdown} readOnly={!canEdit} />
            )}
            {plan.plan_type === "branding" && (
              <BrandingBreakdown data={breakdown} onChange={setBreakdown} readOnly={!canEdit} />
            )}
            {plan.plan_type === "other" && (
              <p className="text-sm text-muted-foreground">Use the description field above for this plan type.</p>
            )}
          </div>

          <Separator />

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Plan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this plan. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
