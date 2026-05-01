import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { backend } from "@/integrations/backend/client";
import { Zap, LogOut, FileText, LayoutDashboard, Menu, Building2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const clientNav = [
  { name: "Overview", href: "/portal", icon: LayoutDashboard },
  { name: "Deliverables", href: "/portal/deliverables", icon: FileText },
];

export default function ClientLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [clientData, setClientData] = useState<any>(null);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await backend.get("/portal") as any;
        if (res?.client) setClientData(res.client);
      } catch (e) {
        console.error("Error fetching branding:", e);
      }
    };
    fetchBranding();
  }, []);

  const goTo = (href: string) => {
    navigate(href);
    setOpen(false);
  };

  const primaryColor = clientData?.brand_color || "#3B82F6";
  const logoUrl = clientData?.logo_url 
    ? (clientData.logo_url.startsWith('http') 
        ? clientData.logo_url 
        : `${import.meta.env.VITE_API_URL.replace('/api', '')}/storage/${clientData.logo_url}`)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Mobile hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  className="sm:hidden rounded-md p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="p-6 border-b">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border shadow-sm overflow-hidden p-1.5">
                      {logoUrl ? (
                        <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <Zap className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <span className="font-black tracking-tighter text-lg">{clientData?.name || "Agency OS"}</span>
                  </div>
                </div>
                <nav className="p-3 space-y-1.5">
                  {clientNav.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <button
                        key={item.name}
                        onClick={() => goTo(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          isActive
                            ? "shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        style={isActive ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : {}}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.name}
                      </button>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border shadow-sm overflow-hidden p-1.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Zap className="h-5 w-5 text-primary" />
                )}
              </div>
              <span className="font-black tracking-tighter text-lg hidden sm:inline-block">{clientData?.name || "Agency OS"}</span>
            </div>

            {/* Desktop nav */}
            <nav className="hidden sm:flex items-center gap-1.5 ml-4">
              {clientNav.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.href)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? "shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                    style={isActive ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : {}}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-black tracking-tight">{profile?.full_name}</span>
              <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Authorized Client</span>
            </div>
            <button
              onClick={signOut}
              className="rounded-xl p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-transparent hover:border-border/50"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}
