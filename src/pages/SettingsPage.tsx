import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { backend } from "@/integrations/backend/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { profile, role } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [internalLabel, setInternalLabel] = useState(profile?.internal_label || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await backend
      .from("profiles")
      .update({ full_name: fullName, internal_label: internalLabel || null })
      .eq("user_id", profile.user_id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
    }
    setSaving(false);
  };

  return (
    <div className="animate-fade-in max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences.</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Input value={role?.replace("_", " ") || "Not assigned"} disabled className="capitalize" />
        </div>
        <div className="space-y-2">
          <Label>Internal Label</Label>
          <Input
            value={internalLabel}
            onChange={(e) => setInternalLabel(e.target.value)}
            placeholder="e.g. Video Editor, SMM, Designer"
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
