import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { assetsApi } from "@/api/assets";
import { clientsApi } from "@/api/clients";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Trash2, Save, FileText, Image, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  brand_color: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  contract_type: string | null;
  onboarded_at: string | null;
  logo_url: string | null;
}

interface Deliverable {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  type: string;
}

interface ClientAsset {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  category: string;
  created_at: string;
}

interface Props {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

const CONTRACT_COLORS: Record<string, string> = {
  retainer: "bg-primary/10 text-primary",
  one_time: "bg-accent/10 text-accent",
  project: "bg-warning/10 text-warning",
};

export default function ClientDetailSheet({ client, open, onOpenChange, onUpdated, onDeleted }: Props) {
  const { role, token } = useAuth();
  const { toast } = useToast();
  const canManage = role === "admin" || role === "manager";
  const isAdmin = role === "admin";

  const [form, setForm] = useState({
    name: "",
    contact_email: "",
    contact_phone: "",
    notes: "",
    brand_color: "#3B82F6",
    is_active: true,
    contract_type: "retainer",
    onboarded_at: undefined as Date | undefined,
  });
  const [saving, setSaving] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [assetSignedUrls, setAssetSignedUrls] = useState<Record<string, string>>({});
  const [loadingExtras, setLoadingExtras] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        contact_email: client.contact_email ?? "",
        contact_phone: client.contact_phone ?? "",
        notes: client.notes ?? "",
        brand_color: client.brand_color ?? "#3B82F6",
        is_active: client.is_active,
        contract_type: client.contract_type ?? "retainer",
        onboarded_at: client.onboarded_at ? new Date(client.onboarded_at) : undefined,
      });
      fetchExtras(client.id);
    }
  }, [client]);

  const fetchExtras = async (clientId: string) => {
    if (!token) return;
    setLoadingExtras(true);
    try {
      const { data } = await clientsApi.get(token, clientId);
      const nextDeliverables = (data.plans || [])
        .flatMap((plan: any) => plan.deliverables || [])
        .sort((a: Deliverable, b: Deliverable) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        })
        .slice(0, 20);
      const nextAssets = ((data as any).assets || []).slice(0, 20);

      setDeliverables(nextDeliverables);
      setAssets(nextAssets);

      const pathAssets = nextAssets.filter((a: ClientAsset) => a.file_url && !a.file_url.startsWith("http"));
      if (pathAssets.length > 0) {
        const entries = await Promise.all(
          pathAssets.map(async (a: ClientAsset) => {
            const { signedUrl } = await assetsApi.signedUrl(token, "client-assets", a.id);
            return [a.id, signedUrl] as [string, string];
          })
        );
        setAssetSignedUrls(Object.fromEntries(entries));
      } else {
        setAssetSignedUrls({});
      }
    } catch (error: any) {
      toast({ title: "Error loading client details", description: error.message, variant: "destructive" });
    } finally {
      setLoadingExtras(false);
    }
  };

  const handleSave = async () => {
    if (!client || !token) return;
    setSaving(true);
    try {
      await clientsApi.update(token, client.id, {
        name: form.name,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        notes: form.notes || null,
        brand_color: form.brand_color,
        is_active: form.is_active,
        contract_type: form.contract_type,
        onboarded_at: form.onboarded_at ? format(form.onboarded_at, "yyyy-MM-dd") : null,
      });
      toast({ title: "Client updated" });
      onUpdated();
    } catch (error: any) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client || !token) return;
    try {
      await clientsApi.delete(token, client.id);
      toast({ title: "Client deleted" });
      onDeleted();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Error deleting", description: error.message, variant: "destructive" });
    }
  };

  const statusColors: Record<string, string> = {
    not_started: "bg-muted text-muted-foreground",
    in_progress: "bg-primary/10 text-primary",
    in_review: "bg-warning/10 text-warning",
    approved: "bg-success/10 text-success",
    delivered: "bg-accent/10 text-accent",
  };

  if (!client) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: form.brand_color }}
            >
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <SheetTitle className="text-left">{client.name}</SheetTitle>
              <Badge className={cn("text-xs mt-0.5 capitalize", CONTRACT_COLORS[form.contract_type] ?? "")}>
                {form.contract_type?.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="overview" className="flex-1"><Building2 className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
            <TabsTrigger value="deliverables" className="flex-1"><FileText className="h-3.5 w-3.5 mr-1.5" />Deliverables ({deliverables.length})</TabsTrigger>
            <TabsTrigger value="assets" className="flex-1"><Image className="h-3.5 w-3.5 mr-1.5" />Assets ({assets.length})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Client Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Email</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Phone</Label>
                <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} disabled={!canManage} />
              </div>
              <div className="space-y-1.5">
                <Label>Contract Type</Label>
                <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })} disabled={!canManage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retainer">Retainer</SelectItem>
                    <SelectItem value="one_time">One-Time</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Onboarded Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.onboarded_at && "text-muted-foreground")} disabled={!canManage}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.onboarded_at ? format(form.onboarded_at, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.onboarded_at} onSelect={(d) => setForm({ ...form, onboarded_at: d })} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Brand Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} disabled={!canManage} className="h-10 w-16 rounded-md border border-input cursor-pointer disabled:opacity-50" />
                  <Input value={form.brand_color} onChange={(e) => setForm({ ...form, brand_color: e.target.value })} disabled={!canManage} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} disabled={!canManage} />
                  <span className="text-sm text-muted-foreground">{form.is_active ? "Active" : "Inactive"}</span>
                </div>
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!canManage} placeholder="Key account details..." />
              </div>
            </div>

            {canManage && (
              <div className="flex items-center justify-between pt-2 border-t border-border">
                {isAdmin ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1.5" />Delete Client</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {client.name}?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the client and all associated data. This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : <div />}
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1.5" />{saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Deliverables Tab */}
          <TabsContent value="deliverables" className="mt-0">
            {loadingExtras ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : deliverables.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">No deliverables found for this client.</div>
            ) : (
              <div className="space-y-2">
                {deliverables.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.type} {d.due_date ? `· Due ${format(new Date(d.due_date), "MMM d")}` : ""}</p>
                    </div>
                    <Badge className={cn("text-xs capitalize", statusColors[d.status] ?? "bg-muted text-muted-foreground")}>
                      {d.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="mt-0">
            {loadingExtras ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : assets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">No assets uploaded for this client.</div>
            ) : (
              <div className="space-y-2">
                {assets.map((a) => {
                  const href = a.file_url.startsWith("http") ? a.file_url : (assetSignedUrls[a.id] ?? "");
                  return (
                    <a key={a.id} href={href || undefined} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                      <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                        <Image className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{a.file_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{a.category} · {format(new Date(a.created_at), "MMM d, yyyy")}</p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
