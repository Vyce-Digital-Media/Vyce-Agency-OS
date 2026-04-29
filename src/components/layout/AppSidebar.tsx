import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  CalendarRange,
  FileText,
  Calendar,
  UserCog,
  Settings,
  LogOut,
  Zap,
  FolderOpen,
  Clock,
} from "lucide-react";

type AppRole = "admin" | "manager" | "team_member" | "client";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "team_member"] },
  { name: "Clients", href: "/clients", icon: Users, roles: ["admin"] },
  { name: "Monthly Plans", href: "/plans", icon: CalendarRange, roles: ["admin", "manager"] },
  { name: "Deliverables", href: "/deliverables", icon: FileText, roles: ["admin", "manager", "team_member"] },
  { name: "Brand Assets", href: "/assets", icon: FolderOpen, roles: ["admin", "manager"] },
  { name: "Calendar", href: "/calendar", icon: Calendar, roles: ["admin", "manager", "team_member"] },
  { name: "Team", href: "/team", icon: UserCog, roles: ["admin", "manager"] },
  { name: "Attendance", href: "/attendance", icon: Clock, roles: ["admin", "manager", "team_member"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

interface AppSidebarProps {
  variant?: "fixed" | "inline";
  onNavigate?: () => void;
}

export default function AppSidebar({ variant = "fixed", onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, role, signOut } = useAuth();

  const filteredNav = navigation.filter((item) =>
    role ? item.roles.includes(role as AppRole) : false
  );

  const handleNav = (href: string) => {
    navigate(href);
    onNavigate?.();
  };

  const containerClass =
    variant === "fixed"
      ? "fixed inset-y-0 left-0 z-50 hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border"
      : "flex h-full w-full flex-col bg-sidebar";

  return (
    <aside className={containerClass}>
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
          Agency OS
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.name}
              onClick={() => handleNav(item.href)}
              className={`sidebar-item w-full ${
                isActive ? "sidebar-item-active" : "sidebar-item-inactive"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
              {profile?.full_name || "User"}
            </p>
            <p className="text-xs text-sidebar-muted capitalize">
              {role?.replace("_", " ") || "Member"}
            </p>
          </div>
          <button
            onClick={signOut}
            className="rounded-md p-1.5 text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
