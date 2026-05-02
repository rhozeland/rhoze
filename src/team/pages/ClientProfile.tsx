import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

/**
 * Minimal client profile page — name + password change. Keeps the client
 * portal self-contained so users never have to wander into team settings.
 */
export default function ClientProfile() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName((user?.user_metadata as any)?.display_name ?? user?.user_metadata?.full_name ?? "");
  }, [user]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: any = { data: { display_name: displayName } };
      if (password.trim().length >= 8) updates.password = password;
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      toast({ title: "Profile updated" });
      setPassword("");
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</div>
        <h1 className="text-2xl font-semibold mt-1">Your profile</h1>
      </div>
      <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Display name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>New password (min 8 chars, optional)</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </form>
    </div>
  );
}