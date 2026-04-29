import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { clientsApi, type Client } from "@/api/clients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Mail, Phone, CalendarIcon, TrendingUp, Users, ArrowUpDown } from "lucide-react";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import ClientDetailSheet from "@/components/ClientDetailSheet";

const CONTRACT_COLORS: Record<string, string> = {
  retainer: "bg-primary/10 text-primary",
  one_time: "bg-accent/10 text-accent",
  project: "bg-warning/10 text-warning",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type FilterType = "all" | "active" | "inactive" | "retainer" | "one_time" | "project";
type SortType = "name" | "onboarded";

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("onboarded");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [onboardedDate, setOnboardedDate] = useState<Date | undefined>(new Date());
  const [formData, setFormData] = useState({
    name: "", contact_email: "", contact_phone: "", notes: "",
    brand_color: "#3B82F6", contract_type: "retainer",
  });
  const { role, token } = useAuth();
  const { toast } = useToast();
  const canManage = role === "admin" || role === "manager";

  const fetchClients = async () => {
    if (!token) return;
    try {
      const { data } = await clientsApi.list(token);
      setClients(data);
    } catch (error: any) {
      toast({ title: "Error loading clients", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, [token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      await clientsApi.create(token, {
        name: formData.name,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        notes: formData.notes || null,
        brand_color: formData.brand_color,
        contract_type: formData.contract_type,
        onboarded_at: onboardedDate ? format(onboardedDate, "yyyy-MM-dd") : null,
      });
      toast({ title: "Client added" });
      setDialogOpen(false);
      setFormData({ name: "", contact_email: "", contact_phone: "", notes: "", brand_color: "#3B82F6", contract_type: "retainer" });
      setOnboardedDate(new Date());
      fetchClients();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // --- Analytics Data ---
  const onboardingChartData = useMemo(() => {
    const last12 = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(startOfMonth(new Date()), 11 - i);
      return { month: MONTH_NAMES[d.getMonth()], year: d.getFullYear(), count: 0, key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
    });
    clients.forEach((c) => {
      const dateStr = c.onboarded_at ?? c.created_at;
      const d = parseISO(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const slot = last12.find((s) => s.key === key);
      if (slot) slot.count += 1;
    });
    return last12;
  }, [clients]);

  // --- Filtered + Sorted ---
  const filtered = useMemo(() => {
    let list = clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    if (filter === "active") list = list.filter((c) => c.is_active);
    else if (filter === "inactive") list = list.filter((c) => !c.is_active);
    else if (filter === "retainer") list = list.filter((c) => c.contract_type === "retainer");
    else if (filter === "one_time") list = list.filter((c) => c.contract_type === "one_time");
    else if (filter === "project") list = list.filter((c) => c.contract_type === "project");

    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const ad = a.onboarded_at ?? a.created_at;
      const bd = b.onboarded_at ?? b.created_at;
      return new Date(bd).getTime() - new Date(ad).getTime();
    });
  }, [clients, search, filter, sort]);

  const filterOptions: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Retainer", value: "retainer" },
    { label: "One-Time", value: "one_time" },
    { label: "Project", value: "project" },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your agency's client roster.</p>
        </div>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Add Client</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 mt-2">
                <div className="space-y-1.5">
                  <Label>Client Name *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Acme Corp" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Contact Email</Label>
                    <Input type="email" value={formData.contact_email} onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })} placeholder="contact@acme.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact Phone</Label>
                    <Input value={formData.contact_phone} onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })} placeholder="+1 234 567 890" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Contract Type</Label>
                  <Select value={formData.contract_type} onValueChange={(v) => setFormData({ ...formData, contract_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retainer">Retainer</SelectItem>
                      <SelectItem value="one_time">One-Time</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Brand Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={formData.brand_color} onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })} className="h-10 w-12 rounded-md border border-input cursor-pointer" />
                      <Input value={formData.brand_color} onChange={(e) => setFormData({ ...formData, brand_color: e.target.value })} className="font-mono text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Onboarded Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !onboardedDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {onboardedDate ? format(onboardedDate, "MMM d, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={onboardedDate} onSelect={setOnboardedDate} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Key account details..." />
                </div>
                <Button type="submit" className="w-full mt-2">Add Client</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "Total Clients", value: clients.length, icon: Users, color: "text-primary" },
          { label: "Active Clients", value: clients.filter((c) => c.is_active).length, icon: TrendingUp, color: "text-success" },
          { label: "Inactive Clients", value: clients.filter((c) => !c.is_active).length, icon: Users, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0", s.color)}>
              <s.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Onboarding Chart */}
      <div className="stat-card">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Client Onboarding (Last 12 Months)
        </h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={onboardingChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              cursor={{ fill: "hsl(var(--muted))" }}
            />
            <Bar dataKey="count" name="Clients" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filter + Sort + Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients..." className="pl-9" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filterOptions.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                filter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortType)}>
          <SelectTrigger className="w-40 h-9 text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="onboarded">Onboard Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Client Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-muted-foreground">{search || filter !== "all" ? "No clients match your filters." : "No clients yet. Add your first client to get started."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((client) => (
            <button
              key={client.id}
              onClick={() => { setSelectedClient(client); setSheetOpen(true); }}
              className="stat-card flex items-center gap-4 text-left hover:border-primary/40 hover:shadow-md transition-all cursor-pointer group w-full"
            >
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center text-base font-bold text-white shrink-0 shadow-sm"
                style={{ backgroundColor: client.brand_color ?? "#3B82F6" }}
              >
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">{client.name}</p>
                  <Badge className={cn("text-[10px] px-1.5 py-0.5 shrink-0 capitalize", CONTRACT_COLORS[client.contract_type ?? "retainer"] ?? "")}>
                    {(client.contract_type ?? "retainer").replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {client.contact_email && (
                    <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{client.contact_email}</span>
                  )}
                  {client.contact_phone && (
                    <span className="flex items-center gap-1 shrink-0"><Phone className="h-3 w-3" />{client.contact_phone}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={cn("status-badge text-[10px]", client.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                  {client.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <ClientDetailSheet
        client={selectedClient}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={() => { fetchClients(); }}
        onDeleted={() => { setSelectedClient(null); fetchClients(); }}
      />
    </div>
  );
}
