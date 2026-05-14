import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "../lib/auth";
import { Upload } from "lucide-react";
import { formatPhone, validateAll, type MastersheetField } from "../lib/validation";
import AvatarEditor from "../components/AvatarEditor";
import AvailabilityEditor from "../components/AvailabilityEditor";

const DEPT_LABEL: Record<string, string> = {
  marketing: "Marketing",
  hr: "HR",
  development: "Development",
  sales: "Sales",
  operations: "Operations",
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_BLOCKS = ["Morning", "Afternoon", "Evening", "Overnight"];

export default function Settings() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editorFile, setEditorFile] = useState<File | null>(null);

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
  const [personal, setPersonal] = useState({ phone: "", address: "", date_of_birth: "", emergency_contact_name: "", emergency_contact_relation: "", emergency_contact_phone: "", alias: "" });

  const personalErrors = validateAll({
    phone: personal.phone,
    date_of_birth: personal.date_of_birth,
    emergency_contact_name: personal.emergency_contact_name,
    emergency_contact_relation: personal.emergency_contact_relation,
    emergency_contact_phone: personal.emergency_contact_phone,
  } as Partial<Record<MastersheetField, string>>);
  const hasPersonalErrors = Object.keys(personalErrors).length > 0;

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        pronouns: profile.pronouns ?? "",
        bio: profile.bio ?? "",
      });
      setPersonal({
        phone: (profile as any).phone ?? "",
        address: (profile as any).address ?? "",
        date_of_birth: (profile as any).date_of_birth ?? "",
        emergency_contact_name: (profile as any).emergency_contact_name ?? "",
        emergency_contact_relation: (profile as any).emergency_contact_relation ?? "",
        emergency_contact_phone: (profile as any).emergency_contact_phone ?? "",
        alias: (profile as any).alias ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (hasPersonalErrors) {
        const first = Object.values(personalErrors)[0];
        throw new Error(first ?? "Please fix the highlighted fields");
      }
      const { error } = await supabase.from("profiles").update({
        display_name: form.display_name.trim() || null,
        pronouns: form.pronouns.trim() || null,
        bio: form.bio.trim() || null,
        phone: personal.phone.trim() || null,
        address: personal.address.trim() || null,
        date_of_birth: personal.date_of_birth || null,
        emergency_contact_name: personal.emergency_contact_name.trim() || null,
        emergency_contact_relation: personal.emergency_contact_relation.trim() || null,
        emergency_contact_phone: personal.emergency_contact_phone.trim() || null,
        alias: personal.alias.trim() || null,
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

  // Availability
  const { data: availability } = useQuery({
    queryKey: ["my-availability", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_availability")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [avail, setAvail] = useState<{ days: string[]; time_blocks: string[]; notes: string }>({ days: [], time_blocks: [], notes: "" });
  useEffect(() => {
    if (availability) {
      setAvail({ days: availability.days ?? [], time_blocks: availability.time_blocks ?? [], notes: availability.notes ?? "" });
    }
  }, [availability]);

  const saveAvail = useMutation({
    mutationFn: async () => {
      const payload = { user_id: user!.id, days: avail.days, time_blocks: avail.time_blocks, notes: avail.notes.trim() || null };
      const { error } = await supabase.from("team_availability").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Availability saved" });
      qc.invalidateQueries({ queryKey: ["my-availability"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  async function handleFile(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image or GIF file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image too large (max 5MB)", variant: "destructive" });
      return;
    }
    // GIFs: upload as-is so the animation is preserved.
    if (file.type === "image/gif") {
      await uploadAvatarBlob(file, "gif");
      return;
    }
    // Static images: open the crop/zoom editor first.
    setEditorFile(file);
  }

  async function uploadAvatarBlob(blob: Blob, ext: string) {
    if (!user) return;
    setUploading(true);
    try {
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const contentType = ext === "gif" ? "image/gif" : "image/png";
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
        upsert: true,
        contentType,
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

  // Account: change email / password
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function changeEmail() {
    const email = newEmail.trim();
    if (!email || email === user?.email) {
      toast({ title: "Enter a different email", variant: "destructive" });
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast({ title: "Check your inbox", description: "Confirm the change from a link sent to your new email." });
      setNewEmail("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password updated" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome, {(form.display_name || user?.email?.split("@")[0] || "there").trim()}!
        </h1>
        <p className="text-sm text-muted-foreground">Your team profile. Visible to other team members.</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsContent value="profile" className="space-y-4">
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
              accept="image/*,image/gif"
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
            <div className="text-xs text-muted-foreground mt-1">PNG, JPG or GIF, up to 5MB.</div>
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
          <div className="space-y-1.5">
            <Label>Alias</Label>
            <Input placeholder="Short handle teammates know you by" value={personal.alias}
              onChange={(e) => setPersonal({ ...personal, alias: e.target.value })} />
            <div className="text-[11px] text-muted-foreground">Shown on your card in the team directory.</div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled readOnly />
            <div className="text-[11px] text-muted-foreground">Change in the Account tab.</div>
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
        </TabsContent>

        <TabsContent value="personal" className="space-y-4">
        <div className="border border-border rounded-lg p-5 bg-card space-y-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Personal & emergency</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input inputMode="tel" placeholder="(416) 555-0123" value={personal.phone}
              onChange={(e) => setPersonal({ ...personal, phone: formatPhone(e.target.value) })} />
            {personalErrors.phone && <div className="text-[11px] text-destructive">{personalErrors.phone}</div>}
          </div>
          <div className="space-y-1.5">
            <Label>Date of birth</Label>
            <Input type="date" max={new Date().toISOString().slice(0, 10)} min="1900-01-01"
              value={personal.date_of_birth}
              onChange={(e) => setPersonal({ ...personal, date_of_birth: e.target.value })} />
            {personalErrors.date_of_birth && <div className="text-[11px] text-destructive">{personalErrors.date_of_birth}</div>}
          </div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Textarea rows={2} value={personal.address} onChange={(e) => setPersonal({ ...personal, address: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Emergency contact name</Label>
            <Input maxLength={80} value={personal.emergency_contact_name}
              onChange={(e) => setPersonal({ ...personal, emergency_contact_name: e.target.value })} />
            {personalErrors.emergency_contact_name && <div className="text-[11px] text-destructive">{personalErrors.emergency_contact_name}</div>}
          </div>
          <div className="space-y-1.5">
            <Label>Relation</Label>
            <Input maxLength={40} placeholder="Mother, Sibling…" value={personal.emergency_contact_relation}
              onChange={(e) => setPersonal({ ...personal, emergency_contact_relation: e.target.value })} />
            {personalErrors.emergency_contact_relation && <div className="text-[11px] text-destructive">{personalErrors.emergency_contact_relation}</div>}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Emergency phone</Label>
            <Input inputMode="tel" placeholder="(416) 555-0123" value={personal.emergency_contact_phone}
              onChange={(e) => setPersonal({ ...personal, emergency_contact_phone: formatPhone(e.target.value) })} />
            {personalErrors.emergency_contact_phone && <div className="text-[11px] text-destructive">{personalErrors.emergency_contact_phone}</div>}
          </div>
        </div>
        <div className="pt-1 flex items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending || hasPersonalErrors}>Save details</Button>
          {hasPersonalErrors && <span className="text-xs text-destructive">Fix the highlighted fields above.</span>}
        </div>
        <p className="text-[11px] text-muted-foreground">Wage, payment method, department and program are managed by an admin in Role Manager.</p>
        </div>
        </TabsContent>

        <TabsContent value="availability" className="space-y-4">
          <AvailabilityEditor />
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <div className="border border-border rounded-lg p-5 bg-card space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Account</div>
            <div className="text-sm"><span className="text-muted-foreground">Email:</span> {user?.email}</div>
            <div className="text-sm"><span className="text-muted-foreground">Roles:</span> {roles.join(", ") || "—"}</div>
            <div className="text-sm"><span className="text-muted-foreground">Department:</span> {dept}</div>
            <div className="text-sm"><span className="text-muted-foreground">Job title:</span> {profile?.job_title || "—"}</div>
            <p className="text-xs text-muted-foreground pt-1">Department and job title are assigned by an admin.</p>
          </div>

          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Change email</div>
            <div className="space-y-1.5">
              <Label>New email</Label>
              <Input type="email" placeholder="you@example.com" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)} />
              <div className="text-[11px] text-muted-foreground">We'll send a confirmation link to the new address before the change takes effect.</div>
            </div>
            <Button onClick={changeEmail} disabled={savingEmail || !newEmail.trim()}>
              {savingEmail ? "Sending…" : "Update email"}
            </Button>
          </div>

          <div className="border border-border rounded-lg p-5 bg-card space-y-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Change password</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input type="password" autoComplete="new-password" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm password</Label>
                <Input type="password" autoComplete="new-password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">Minimum 8 characters.</div>
            <Button onClick={changePassword} disabled={savingPassword || !newPassword || !confirmPassword}>
              {savingPassword ? "Saving…" : "Update password"}
            </Button>
          </div>
        </TabsContent>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="personal">Personal & emergency</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="account">Account Settings</TabsTrigger>
        </TabsList>
      </Tabs>

      <AvatarEditor
        open={!!editorFile}
        file={editorFile}
        onCancel={() => setEditorFile(null)}
        onApply={async (blob) => {
          setEditorFile(null);
          await uploadAvatarBlob(blob, "png");
        }}
      />
    </div>
  );
}
