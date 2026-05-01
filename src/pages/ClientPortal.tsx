import { useEffect, useState } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Calendar, CheckCircle2, Clock, Eye, Palette, Type, Image, ExternalLink, Zap, Building2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Asset {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
}

interface Deliverable {
  id: string;
  title: string;
  type: string;
  status: string;
  due_date: string | null;
  description: string | null;
  plan_id: string;
  assets?: Asset[];
}

interface Plan {
  id: string;
  month: number;
  year: number;
  total_deliverables: number;
  status: string;
  description: string | null;
  deliverables: Deliverable[];
}

interface BrandKit {
  id: string;
  name: string;
  category: "logo" | "color" | "font" | "asset";
  content: string | null;
  file_url: string | null;
  link_url: string | null;
}

interface ClientData {
  id: string;
  name: string;
  brand_color: string | null;
  secondary_color: string | null;
  brand_slogan: string | null;
  logo_url: string | null;
  brand_kits: BrandKit[];
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
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching portal data...");
        const dashRes = await backend.get("/portal") as { client: ClientData; plans: Plan[] };
        console.log("Portal data received:", dashRes);
        if (dashRes?.client) setClientData(dashRes.client);
        if (dashRes?.plans) setPlans(dashRes.plans);
      } catch (error) {
        console.error("Error fetching portal data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activePlan = plans[0];
  const allDeliverables = plans.flatMap(p => p.deliverables || []);
  const recentAssets = allDeliverables
    .flatMap(d => (d.assets || []).map(a => ({ ...a, deliverableTitle: d.title })))
    .slice(0, 6);

  // Branding fallbacks
  const primaryColor = clientData?.brand_color || "#3B82F6";
  const secondaryColor = clientData?.secondary_color || "#10B981";
  const logoUrl = clientData?.logo_url 
    ? (clientData.logo_url.startsWith('http') 
        ? clientData.logo_url 
        : `${import.meta.env.VITE_API_URL.replace('/api', '')}/storage/${clientData.logo_url}`)
    : null;

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
    <div className="animate-fade-in" style={{ 
      '--client-primary': primaryColor,
      '--client-secondary': secondaryColor
    } as React.CSSProperties}>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-white border shadow-sm p-2 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt={clientData?.name || "Client"} className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground/30" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md bg-muted" style={{ color: primaryColor }}>
                {clientData?.name || "Client Portal"}
              </span>
            </div>
            <h1 
              className="text-3xl font-black tracking-tight" 
              style={{ 
                color: primaryColor, // Fallback if gradient fails
                backgroundImage: `linear-gradient(to right, ${primaryColor}, ${secondaryColor})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
            </h1>
            <p className="text-muted-foreground mt-1 text-lg font-medium opacity-80 italic">
              {clientData?.brand_slogan || "Here's a snapshot of your project's progress."}
            </p>
          </div>
        </div>
        {activePlan && (
          <div 
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border shadow-sm transition-all hover:scale-105"
            style={{ 
              backgroundColor: `${primaryColor}10`,
              borderColor: `${primaryColor}30`
            }}
          >
            <Calendar className="h-4 w-4" style={{ color: primaryColor }} />
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
              {MONTHS[activePlan.month - 1]} {activePlan.year} Plan
            </span>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="w-full sm:w-auto p-1.5 bg-muted/50 rounded-2xl border border-border/50">
          <TabsTrigger value="overview" className="rounded-xl px-6 data-[state=active]:shadow-lg">Overview</TabsTrigger>
          <TabsTrigger value="brand-kit" className="rounded-xl px-6 data-[state=active]:shadow-lg">Brand Kit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-10 space-y-12 focus-visible:outline-none">
          {/* Main Grid: Plan and Deliverables */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Active Plan & Progress */}
            <div className="lg:col-span-4 space-y-8">
              <h2 className="text-xl font-black flex items-center gap-3 tracking-tight">
                <div className="h-3 w-3 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
                Your Success
              </h2>
              {activePlan ? (
                <div 
                  className="stat-card p-8 border shadow-xl relative overflow-hidden group rounded-[2rem]"
                  style={{ 
                    borderColor: `${primaryColor}30`,
                    background: `linear-gradient(135deg, ${primaryColor}05 0%, ${secondaryColor}05 100%)`
                  }}
                >
                  <div className="absolute -top-12 -right-12 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 rotate-12 group-hover:rotate-0 scale-150">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-48 w-48 grayscale" />
                    ) : (
                      <Zap className="h-48 w-48" />
                    )}
                  </div>
                  <div className="space-y-6 relative z-10">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60">Current Cycle</p>
                      <p className="text-3xl font-black mt-2 tracking-tight">
                        {MONTHS[activePlan.month - 1]} {activePlan.year}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-muted-foreground">Milestones Reached</span>
                        <span style={{ color: primaryColor }}>
                          {Math.round((activePlan.deliverables.filter(d => d.status === 'approved' || d.status === 'delivered').length / activePlan.total_deliverables) * 100)}%
                        </span>
                      </div>
                      <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden p-0.5 border border-border/50">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm" 
                          style={{ 
                            width: `${(activePlan.deliverables.filter(d => d.status === 'approved' || d.status === 'delivered').length / activePlan.total_deliverables) * 100}%`,
                            background: `linear-gradient(90deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5 pt-4">
                      <div className="p-4 rounded-2xl bg-white/50 border border-white/80 shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Total Tasks</p>
                        <p className="text-2xl font-black mt-1">{activePlan.total_deliverables}</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/50 border border-white/80 shadow-inner">
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">Status</p>
                        <p className="text-xs font-black mt-2 uppercase tracking-tighter" style={{ color: primaryColor }}>
                          {activePlan.status.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="stat-card p-12 text-center border-dashed border-2 rounded-[2rem]">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-muted-foreground font-medium">Your active plan is being prepared.</p>
                </div>
              )}
            </div>

            {/* Right Column: Project Tasks (Deliverables) */}
            <div className="lg:col-span-8 space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black flex items-center gap-3 tracking-tight">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                  Active Deliverables
                </h2>
              </div>
              <div className="stat-card p-4 space-y-3 rounded-[2rem] shadow-xl border-border/50">
                {activePlan?.deliverables.length ? (
                  activePlan.deliverables.slice(0, 6).map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-5 px-6 hover:bg-muted/30 transition-all rounded-2xl group cursor-pointer border border-transparent hover:border-border/50">
                      <div className="flex items-center gap-5 min-w-0">
                        <div className={cn(
                          "h-14 w-14 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-500 group-hover:rotate-6 group-hover:scale-110 shadow-sm",
                          STATUS_STYLES[d.status]
                        )}>
                          {TYPE_LABELS[d.type]?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-black truncate group-hover:text-primary transition-colors tracking-tight">{d.title}</p>
                          <div className="flex items-center gap-3 mt-1.5 opacity-70">
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md bg-muted/80">{TYPE_LABELS[d.type]}</span>
                            {d.due_date && (
                              <span className="text-[11px] font-bold flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" /> {new Date(d.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`status-badge text-[10px] px-3.5 py-1.5 rounded-full font-black uppercase tracking-widest shadow-sm ${STATUS_STYLES[d.status]}`}>
                          {STATUS_LABELS[d.status]}
                        </span>
                        <Eye className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-300" />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-20 text-center text-muted-foreground">
                    <p className="text-lg font-medium italic opacity-40">Your roadmap is under construction.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section: Recent Assets Preview */}
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black flex items-center gap-3 tracking-tight">
                <Image className="h-6 w-6" style={{ color: primaryColor }} />
                Creative Gallery
              </h2>
            </div>
            {recentAssets.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {recentAssets.map((asset) => (
                  <div key={asset.id} className="group relative aspect-square rounded-[1.5rem] overflow-hidden border border-border bg-muted shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                    {asset.file_type?.startsWith('image/') ? (
                      <img src={asset.file_url} alt={asset.file_name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-125" />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center gap-3 bg-gradient-to-br from-muted to-muted/50">
                        <div className="p-4 rounded-2xl bg-white shadow-sm transition-transform group-hover:rotate-12">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest truncate w-full">{asset.file_name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 p-5 flex flex-col justify-end translate-y-4 group-hover:translate-y-0">
                      <p className="text-[9px] text-white/50 font-black uppercase tracking-[0.2em] mb-1">Project Component</p>
                      <p className="text-sm text-white font-black truncate mb-4 tracking-tight">{asset.deliverableTitle}</p>
                      <a 
                        href={asset.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-white text-black text-[10px] font-black rounded-xl text-center hover:bg-white/90 transition-all active:scale-95 uppercase tracking-widest"
                      >
                        Get File
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="stat-card p-16 text-center border-dashed border-2 rounded-[2.5rem]">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                  <Image className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-black mb-2 tracking-tight">Gallery is empty</h3>
                <p className="text-muted-foreground text-sm font-medium">Approved assets will populate this creative workspace.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="brand-kit" className="mt-6">
          {!clientData?.brand_kits?.length ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Palette className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Brand Kit Empty</h3>
              <p className="text-muted-foreground text-sm">Your agency hasn't uploaded any brand assets yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Categorized view */}
              {["logo", "color", "font", "asset"].map(category => {
                const items = clientData?.brand_kits?.filter(i => i.category === category) || [];
                if (items.length === 0) return null;
                return (
                  <div key={category} className="space-y-4">
                    <h3 className="text-sm font-semibold capitalize flex items-center gap-2">
                      {category === "logo" && <Image className="h-4 w-4" />}
                      {category === "color" && <Palette className="h-4 w-4" />}
                      {category === "font" && <Type className="h-4 w-4" />}
                      {category === "asset" && <ExternalLink className="h-4 w-4" />}
                      {category}s
                    </h3>
                    <div className="space-y-3">
                      {items.map(item => (
                        <div key={item.id} className="stat-card p-4">
                          <p className="text-xs font-bold mb-2">{item.name}</p>
                          {item.category === "color" ? (
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg border shadow-sm" style={{ backgroundColor: item.content || "#000" }} />
                              <code className="text-xs bg-muted px-2 py-1 rounded">{item.content}</code>
                            </div>
                          ) : item.category === "logo" && item.file_url ? (
                            <img src={item.file_url} alt={item.name} className="max-h-20 object-contain" />
                          ) : (
                            <p className="text-sm text-muted-foreground">{item.content}</p>
                          )}
                          {item.link_url && (
                            <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline mt-3 block flex items-center gap-1">
                              View Resource <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

