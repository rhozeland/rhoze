import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Sparkles, ExternalLink, BadgePercent, Gift, Wallet } from "lucide-react";

/**
 * Minimal client profile page — name + password change. Keeps the client
 * portal self-contained so users never have to wander into team settings.
 */
export default function ClientProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["client_profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, display_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    setDisplayName(
      profile?.display_name ??
        (user?.user_metadata as any)?.display_name ??
        user?.user_metadata?.full_name ??
        ""
    );
  }, [user, profile]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 5 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: url }, { onConflict: "id" });
      if (profErr) throw profErr;
      await supabase.auth.updateUser({ data: { avatar_url: url } });
      qc.invalidateQueries({ queryKey: ["client_profile", user.id] });
      toast({ title: "Avatar updated" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, avatar_url: null }, { onConflict: "id" });
      if (error) throw error;
      await supabase.auth.updateUser({ data: { avatar_url: null } });
      qc.invalidateQueries({ queryKey: ["client_profile", user.id] });
      toast({ title: "Avatar removed" });
    } catch (err: any) {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates: any = { data: { display_name: displayName } };
      if (password.trim().length >= 8) updates.password = password;
      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      // Mirror display_name into profiles row.
      if (user?.id) {
        await supabase
          .from("profiles")
          .upsert({ id: user.id, display_name: displayName }, { onConflict: "id" });
      }
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
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="size-16 rounded-full bg-muted overflow-hidden border border-border shrink-0 flex items-center justify-center text-muted-foreground">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Avatar" className="size-full object-cover" />
          ) : (
            <span className="text-lg font-medium">
              {(displayName || user?.email || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">Profile photo</div>
          <p className="text-xs text-muted-foreground">PNG or JPG, up to 5 MB.</p>
          <div className="flex gap-2 mt-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload size={14} className="mr-1.5" />
              {uploading ? "Uploading…" : profile?.avatar_url ? "Replace" : "Upload"}
            </Button>
            {profile?.avatar_url && (
              <Button size="sm" variant="ghost" disabled={uploading} onClick={removeAvatar}>
                <Trash2 size={14} className="mr-1.5" /> Remove
              </Button>
            )}
          </div>
        </div>
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

      {/* About $RHOZE */}
      <section className="rounded-2xl border border-border bg-gradient-to-br from-fuchsia-500/10 via-primary/5 to-transparent p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-fuchsia-500 dark:text-fuchsia-400" />
          <div className="text-xs uppercase tracking-wider text-muted-foreground">About $RHOZE</div>
        </div>
        <h2 className="text-lg font-semibold">A token that pays you back — and pays for your work.</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Every dollar you spend with Rhozeland earns you <strong className="text-foreground">$RHOZE</strong>, our
          Solana-based community token. You can hold it, trade it on Pump.fun, or spend it back on services here —
          full or partial invoices in $RHOZE get a steep discount on the listed price.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2"><Gift size={14} className="mt-0.5 shrink-0 text-fuchsia-500 dark:text-fuchsia-400" />
            <span><strong className="text-foreground">Earn it.</strong> Auto-credited on paid invoices, plus bonuses for events, referrals, and milestones.</span>
          </li>
          <li className="flex gap-2"><BadgePercent size={14} className="mt-0.5 shrink-0 text-fuchsia-500 dark:text-fuchsia-400" />
            <span><strong className="text-foreground">Spend it.</strong> Pay future invoices in $RHOZE for a discount — token price floats with the market, the discount is applied at checkout.</span>
          </li>
          <li className="flex gap-2"><Wallet size={14} className="mt-0.5 shrink-0 text-fuchsia-500 dark:text-fuchsia-400" />
            <span><strong className="text-foreground">Withdraw it.</strong> Link a Solana wallet (Phantom, Solflare) on any project to receive on-chain payouts.</span>
          </li>
        </ul>
        <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Two sides of Rhozeland.</strong> This site (rhozeland.com) is where productions, campaigns,
          and ideas come to life. The <strong className="text-foreground">Rhozeland Creator OS</strong> app is where the
          community showcases work, attends events, and gets rewarded. $RHOZE is the gateway between them — earn on either side, spend on either side.
        </div>
        <a
          href="https://rhozeland-creator-os.lovable.app"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          <ExternalLink size={12} /> Open Rhozeland Creator OS
        </a>
      </section>
    </div>
  );
}