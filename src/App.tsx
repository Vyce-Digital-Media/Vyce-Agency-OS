import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleRoute from "@/components/RoleRoute";
import AppLayout from "@/components/layout/AppLayout";
import ClientLayout from "@/components/layout/ClientLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Plans from "./pages/Plans";
import Deliverables from "./pages/Deliverables";
import Calendar from "./pages/Calendar";
import Team from "./pages/Team";
import SettingsPage from "./pages/SettingsPage";
import ClientAssets from "./pages/ClientAssets";
import ClientPortal from "./pages/ClientPortal";
import ClientDeliverables from "./pages/ClientDeliverables";
import Attendance from "./pages/Attendance";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function RoleRouter() {
  const { role, loading } = useAuth();

  if (loading) return null;

  // Client role gets a separate portal layout
  if (role === "client") {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          element={
            <ProtectedRoute>
              <ClientLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/portal" element={<ClientPortal />} />
          <Route path="/portal/deliverables" element={<ClientDeliverables />} />
        </Route>
        <Route path="/" element={<Navigate to="/portal" replace />} />
        <Route path="/dashboard" element={<Navigate to="/portal" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<RoleRoute allowed={["admin"]}><Clients /></RoleRoute>} />
        <Route path="/plans" element={<RoleRoute allowed={["admin", "manager"]}><Plans /></RoleRoute>} />
        <Route path="/deliverables" element={<Deliverables />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/team" element={<RoleRoute allowed={["admin", "manager"]}><Team /></RoleRoute>} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/settings" element={<RoleRoute allowed={["admin"]}><SettingsPage /></RoleRoute>} />
        <Route path="/assets" element={<RoleRoute allowed={["admin", "manager"]}><ClientAssets /></RoleRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RoleRouter />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
