import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { backend } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  duration_seconds: number | null;
  date: string;
  notes: string | null;
  is_break: boolean;
}

interface AttendanceStats {
  gross_secs: number;
  break_secs: number;
}

interface AttendanceStatus {
  active_work: TimeEntry | null;
  active_break: TimeEntry | null;
  today_stats: AttendanceStats;
  week_stats: AttendanceStats;
}

interface AttendanceContextType {
  status: AttendanceStatus | null;
  loading: boolean;
  clockingIn: boolean;
  clockingOut: boolean;
  breakLoading: boolean;
  refreshStatus: () => Promise<void>;
  clockIn: (notes?: string) => Promise<void>;
  clockOut: () => Promise<void>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
}

const AttendanceContext = createContext<AttendanceContextType | undefined>(undefined);

export function AttendanceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [status, setStatus] = useState<AttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [breakLoading, setBreakLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      setLoading(false);
      return;
    }
    try {
      const res = await backend.get("/attendance/status");
      setStatus(res as unknown as AttendanceStatus);
    } catch (e: any) {
      console.error("Failed to fetch attendance status", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshStatus();
    
    // Optional: Refresh on window focus to keep timers exactly in sync if tab was inactive
    const onFocus = () => refreshStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshStatus]);

  const clockIn = async (notes?: string) => {
    if (clockingIn) return;
    setClockingIn(true);
    const { error } = await backend.post("/attendance/clock-in", { notes: notes || null });
    if (error) {
      toast({ title: "Clock-in failed", description: (error as any).message, variant: "destructive" });
    } else {
      toast({ title: "Clocked in!", description: `Started at ${new Date().toLocaleTimeString()}` });
      await refreshStatus();
    }
    setClockingIn(false);
  };

  const clockOut = async () => {
    if (clockingOut) return;
    setClockingOut(true);
    const { error } = await backend.post("/attendance/clock-out");
    if (error) {
      toast({ title: "Clock-out failed", description: (error as any).message, variant: "destructive" });
    } else {
      toast({ title: "Clocked out!", description: `Ended at ${new Date().toLocaleTimeString()}` });
      await refreshStatus();
    }
    setClockingOut(false);
  };

  const startBreak = async () => {
    if (breakLoading) return;
    setBreakLoading(true);
    const { error } = await backend.post("/attendance/break-start");
    if (error) {
      toast({ title: "Break start failed", description: (error as any).message, variant: "destructive" });
    } else {
      toast({ title: "Break started" });
      await refreshStatus();
    }
    setBreakLoading(false);
  };

  const endBreak = async () => {
    if (breakLoading) return;
    setBreakLoading(true);
    const { error } = await backend.post("/attendance/break-end");
    if (error) {
      toast({ title: "Break end failed", description: (error as any).message, variant: "destructive" });
    } else {
      toast({ title: "Break ended", description: "Welcome back!" });
      await refreshStatus();
    }
    setBreakLoading(false);
  };

  return (
    <AttendanceContext.Provider value={{
      status, loading, clockingIn, clockingOut, breakLoading,
      refreshStatus, clockIn, clockOut, startBreak, endBreak
    }}>
      {children}
    </AttendanceContext.Provider>
  );
}

export function useAttendanceData() {
  const context = useContext(AttendanceContext);
  if (context === undefined) {
    throw new Error("useAttendanceData must be used within an AttendanceProvider");
  }
  return context;
}
