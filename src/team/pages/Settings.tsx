import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "../lib/auth";
import { Upload } from "lucide-react";

const DEPT_LABEL: Record<string, string> = {
  marketing: "Marketing",
  hr: "HR",
  development: "Development",
  sales: "Sales",
};

export default function Settings() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ display_name: "", pronouns: "", bio: "" });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        pronouns: profile.pronouns ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        display_name: form.display_name.trim() || null,
        pronouns: form.pronouns.trim() || null,
        bio: form.bio.trim() || null,
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

  async function handleFile(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large (max 5MB)", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", user.id);
      if (updErr) throw updErr;
      toast({ title: "Avatar updated" });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["team-directory"] });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const dept = profile?.department ? DEPT_LABEL[profile.department] : "Unassigned";
  const initial = (form.display_name || user?.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Your team profile. Visible to other team members.</p>
      </div>

      <div className="border border-border rounded-lg p-5 bg-card space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Account</div>
        <div className="text-sm"><span className="text-muted-foreground">Email:</span> {user?.email}</div>
        <div className="text-sm"><span className="text-muted-foreground">Roles:</span> {roles.join(", ") || "—"}</div>
        <div className="text-sm"><span className="text-muted-foreground">Department:</span> {dept}</div>
        <div className="text-sm"><span className="text-muted-foreground">Job title:</span> {profile?.job_title || "—"}</div>
        <p className="text-xs text-muted-foreground pt-1">Department and job title are assigned by an admin.</p>
      </div>

      <div className="border border-border rounded-lg p-5 bg-card space-y-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Profile</div>

        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border border-border" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-xl font-medium border border-border">
              {initial}
            </div>
          )}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={14} className="mr-1.5" />
              {uploading ? "Uploading…" : profile?.avatar_url ? "Change photo" : "Upload photo"}
            </Button>
            <div className="text-xs text-muted-foreground mt-1">PNG or JPG, up to 5MB.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Pronouns</Label>
            <Input placeholder="they/them" value={form.pronouns} onChange={(e) => setForm({ ...form, pronouns: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Bio</Label>
            <Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save profile</Button>
        </div>
      </div>
    </div>
  );
}
