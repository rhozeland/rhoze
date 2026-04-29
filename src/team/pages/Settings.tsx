import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "../lib/auth";

export default function Settings() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    display_name: "", job_title: "", specialty: "", pronouns: "",
    bio: "", avatar_url: "", website: "", portfolio_url: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        job_title: profile.job_title ?? "",
        specialty: profile.specialty ?? "",
        pronouns: profile.pronouns ?? "",
        bio: profile.bio ?? "",
        avatar_url: profile.avatar_url ?? "",
        website: profile.website ?? "",
        portfolio_url: profile.portfolio_url ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        display_name: form.display_name.trim() || null,
        job_title: form.job_title.trim() || null,
        specialty: form.specialty.trim() || null,
        pronouns: form.pronouns.trim() || null,
        bio: form.bio.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        website: form.website.trim() || null,
        portfolio_url: form.portfolio_url.trim() || null,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Profile saved" });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["team-directory"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your team profile. Visible to other team members.</p>
      </div>

      <div className="border border-border rounded-lg p-5 bg-card space-y-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Account</div>
        <div className="text-sm"><span className="text-muted-foreground">Email:</span> {user?.email}</div>
        <div className="text-sm"><span className="text-muted-foreground">Roles:</span> {roles.join(", ") || "—"}</div>
      </div>

      <div className="border border-border rounded-lg p-5 bg-card space-y-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Profile</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Display name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Pronouns</Label><Input placeholder="they/them" value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Job title</Label><Input placeholder="Lead Designer" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Specialty</Label><Input placeholder="Brand identity, motion, A&R…" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Bio</Label><Textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Avatar URL</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Portfolio URL</Label><Input placeholder="Behance, Dribbble, personal site…" value={form.portfolio_url} onChange={(e) => setForm({ ...form, portfolio_url: e.target.value })} /></div>
        </div>
        <div className="pt-2"><Button onClick={() => save.mutate()} disabled={save.isPending}>Save profile</Button></div>
      </div>
    </div>
  );
}
