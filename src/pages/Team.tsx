import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { teamApi } from "@/api/team";
import type { AppRole } from "@/api/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Clock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  user_id: string;
  full_name: string;
  internal_label: string | null;
  avatar_url: string | null;
  role?: string;
  deliverableCount?: number;
  expected_start_time?: string | null;
  salary_hourly?: number | null;
  totalEstimatedMinutes?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  team_member: "Team Member",
  client: "Client",
};

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-primary/10 text-primary",
  team_member: "bg-accent/10 text-accent",
  client: "bg-muted text-muted-foreground",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Team() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingExpected, setEditingExpected] = useState<string | null>(null);
  const [expectedInput, setExpectedInput] = useState("");
  const [editingSalary, setEditingSalary] = useState<string | null>(null);
  const [salaryInput, setSalaryInput] = useState("");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("team_member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string } | null>(null);

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const { role, user, token } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const isAdminOrManager = role === "admin" || role === "manager";

  const fetchTeam = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await teamApi.list(token);
      setMembers(data);
    } catch (error: any) {
      toast({ title: "Error loading team", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, token]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!token) return;
    try {
      await teamApi.updateRole(token, userId, newRole as AppRole);
      toast({ title: "Role updated" });
      fetchTeam();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveExpected = async (userId: string) => {
    if (!token) return;
    try {
      await teamApi.updateProfile(token, userId, { expected_start_time: expectedInput || null });
      toast({ title: "Expected start time saved" });
      setEditingExpected(null);
      fetchTeam();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveSalary = async (userId: string) => {
    if (!token) return;
    try {
      await teamApi.updateProfile(token, userId, { salary_hourly: salaryInput ? parseFloat(salaryInput) : null });
      toast({ title: "Salary updated" });
      setEditingSalary(null);
      fetchTeam();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ── Invite member ──────────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) return;
    if (!token) return;
    setInviteLoading(true);
    try {
      await teamApi.invite(token, {
        email: inviteEmail,
        full_name: inviteName,
        role: inviteRole as AppRole,
      });

      setInviteResult({ email: inviteEmail });
      toast({ title: "Invite sent!", description: `${inviteName} will receive an email to set up their account.` });
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Invite failed", description: err.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  const resetInvite = () => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("team_member");
    setInviteResult(null);
  };

  // ── Remove member ─────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!removeTarget) return;
    if (!token) return;
    setRemoveLoading(true);
    try {
      await teamApi.remove(token, removeTarget.user_id);

      toast({ title: "Member removed", description: `${removeTarget.full_name} has been removed.` });
      setRemoveTarget(null);
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" });
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">Manage team members, roles, and schedules.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="stat-card animate-pulse h-20" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">No team members</h3>
          <p className="text-muted-foreground text-sm">Team members will appear here after signing up.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {members.map((m) => (
            <div key={m.user_id} className="stat-card">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-semibold shrink-0">
                    {m.full_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold">{m.full_name || "Unnamed"}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {m.internal_label && <span>{m.internal_label}</span>}
                      {m.deliverableCount! > 0 && (
                        <>
                          {m.internal_label && <span>·</span>}
                          <span>{m.deliverableCount} tasks ({Math.round((m.totalEstimatedMinutes || 0) / 60)}h)</span>
                        </>
                      )}
                    </div>
                    {/* Workload Bar */}
                    {m.deliverableCount! > 0 && (
                      <div className="mt-2 w-32 h-1 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            (m.totalEstimatedMinutes || 0) > 2400 ? "bg-destructive" : (m.totalEstimatedMinutes || 0) > 1800 ? "bg-warning" : "bg-primary"
                          )}
                          style={{ width: `${Math.min(100, ((m.totalEstimatedMinutes || 0) / 2400) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  {isAdminOrManager && (
                    <>
                      {/* Expected start time */}
                      {editingExpected === m.user_id ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="time" value={expectedInput}
                            onChange={(e) => setExpectedInput(e.target.value)}
                            className="h-8 w-32 text-xs"
                          />
                          <Button size="sm" className="h-8 px-2 text-xs" onClick={() => handleSaveExpected(m.user_id)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingExpected(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                          onClick={() => { setEditingExpected(m.user_id); setExpectedInput(m.expected_start_time || "09:00"); }}
                        >
                          <Clock className="h-3 w-3" />
                          {m.expected_start_time ? `Starts ${m.expected_start_time.slice(0, 5)}` : "Set start time"}
                        </button>
                      )}

                      {/* Salary (admin only) */}
                      {isAdmin && (
                        <>
                          {editingSalary === m.user_id ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">$/hr</span>
                              <Input
                                type="number" value={salaryInput}
                                onChange={(e) => setSalaryInput(e.target.value)}
                                className="h-8 w-24 text-xs" placeholder="e.g. 25"
                              />
                              <Button size="sm" className="h-8 px-2 text-xs" onClick={() => handleSaveSalary(m.user_id)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingSalary(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <button
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => { setEditingSalary(m.user_id); setSalaryInput(m.salary_hourly?.toString() || ""); }}
                            >
                              {m.salary_hourly ? `$${m.salary_hourly}/hr` : "Set salary"}
                            </button>
                          )}
                        </>
                      )}

                      {/* Role (admin only) */}
                      {isAdmin ? (
                        <Select value={m.role || ""} onValueChange={(val) => handleRoleChange(m.user_id, val)}>
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="No role" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className={`status-badge ${ROLE_STYLES[m.role || ""] || "bg-muted text-muted-foreground"}`}>
                          {ROLE_LABELS[m.role || ""] || "No Role"}
                        </span>
                      )}

                      {/* Remove (admin only, not self) */}
                      {isAdmin && m.user_id !== user?.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setRemoveTarget(m)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}

                  {!isAdminOrManager && (
                    <span className={`status-badge ${ROLE_STYLES[m.role || ""] || "bg-muted text-muted-foreground"}`}>
                      {ROLE_LABELS[m.role || ""] || "No Role"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetInvite(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{inviteResult ? "Invite Sent" : "Invite Team Member"}</DialogTitle>
            <DialogDescription>
              {inviteResult ? "An invitation email has been sent." : "Add a new member to your team."}
            </DialogDescription>
          </DialogHeader>

          {inviteResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">Email:</span> {inviteResult.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  We've sent an invitation link. The member should check their inbox and follow the link to set their password and sign in.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={resetInvite}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="john@agency.com" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetInvite}>Cancel</Button>
                <Button onClick={handleInvite} disabled={inviteLoading || !inviteEmail || !inviteName}>
                  {inviteLoading ? "Creating..." : "Create Member"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this member's account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removeLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removeLoading ? "Removing..." : "Remove Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
