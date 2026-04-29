import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

type AppRole = "admin" | "manager" | "team_member" | "client";

interface RoleRouteProps {
  children: React.ReactNode;
  allowed: AppRole[];
}

export default function RoleRoute({ children, allowed }: RoleRouteProps) {
  const { role, loading } = useAuth();
  if (loading) return null;
  if (!role || !allowed.includes(role as AppRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
