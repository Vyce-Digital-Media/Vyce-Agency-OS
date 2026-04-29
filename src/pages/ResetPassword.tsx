import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Zap } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = params.get("token") || "";
  const email = params.get("email") || "";
  const isInvite = params.get("type") === "invite";
  const hasResetParams = Boolean(token && email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasResetParams) {
      toast({ title: "Invalid link", description: "Ask your administrator for a fresh invite or reset link.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({
        email,
        token,
        password,
        password_confirmation: confirm,
      });
      toast({
        title: isInvite ? "Account ready" : "Password updated",
        description: "You can now sign in with your new password.",
      });
      navigate("/auth");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">Agency OS</span>
        </div>

        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight">
            {isInvite ? "Set your password" : "Reset your password"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {isInvite
              ? "Welcome! Choose a password to activate your account."
              : "Choose a new password for your account."}
          </p>
        </div>

        {!hasResetParams ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-center">
            <p className="text-destructive font-medium mb-2">Invalid or expired link</p>
            <p className="text-muted-foreground mb-3">
              This link is no longer valid. Ask your administrator to send a new invite, or request a fresh password reset.
            </p>
            <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Saving..." : isInvite ? "Activate account" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
