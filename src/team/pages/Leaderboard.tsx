import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, ExternalLink, Check, X, Pencil } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Row = {
  id?: string;
  username: string;
  points: number;
  raids: number;
  memes: number;
  edu_threads: number;
  videos: number;
  challenges_completed: number;
  last_updated?: string;
  published_at?: string | null;
  sort_order?: number;
};

type Submission = {
  id: string;
  user_id: string | null;
  handle: string;
  category: "raid" | "meme" | "thread" | "video";
  post_url: string;
  status: "pending" | "approved" | "rejected";
  awarded_points: number;
  reviewer_notes: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  community_username: string | null;
  email: string | null;
  payment_email: string | null;
  social_handle: string | null;
  created_at: string;
};

type Socials = { x?: string; ig?: string; tt?: string; yt?: string };
function parseSocials(raw: string | null): Socials {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object") return o as Socials;
  } catch {}
  return { x: raw };
}
function stringifySocials(s: Socials): string | null {
  const cleaned: Socials = {};
  (Object.keys(s) as (keyof Socials)[]).forEach((k) => {
    const v = (s[k] || "").trim();
    if (v) cleaned[k] = v;
  });
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
}

export default function Leaderboard() {
  const { roles, isAdmin } = useAuth();
  const canEdit = isAdmin || roles.includes("marketing" as any);

  const [rows, setRows] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileFilter, setProfileFilter] = useState("");
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editDraft, setEditDraft] = useState<{ username: string; email: string; pay: string; socials: Socials }>({ username: "", email: "", pay: "", socials: {} });
  const [pointsDraft, setPointsDraft] = useState<Record<string, number>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [a, d, p] = await Promise.all([
      supabase.from("community_leaderboard").select("*").order("points", { ascending: false }),
      supabase.from("community_submissions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id,display_name,community_username,email,payment_email,social_handle,created_at").order("created_at", { ascending: false }),
    ]);
    if (a.data) setRows(a.data as any);
    if (d.data) setSubs(d.data as any);
    if (p.data) setProfiles(p.data as any);
    setLoading(false);
  }

  function openEditProfile(p: Profile) {
    setEditingProfile(p);
    setEditDraft({
      username: p.community_username || p.display_name || "",
      email: p.email || "",
      pay: p.payment_email || "",
      socials: parseSocials(p.social_handle),
    });
  }

  async function saveProfileEdit() {
    if (!editingProfile) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        community_username: editDraft.username.trim() || null,
        email: editDraft.email.trim() || null,
        payment_email: editDraft.pay.trim() || null,
        social_handle: stringifySocials(editDraft.socials),
      }).eq("id", editingProfile.id);
      if (error) throw error;
      toast({ title: "Profile updated" });
      setEditingProfile(null);
      await load();
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  useEffect(() => { load(); }, []);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function addRow() {
    setRows((r) => [
      ...r,
      {
        username: "@newuser",
        points: 0, raids: 0, memes: 0, edu_threads: 0, videos: 0,
        challenges_completed: 0,
        last_updated: new Date().toISOString().slice(0, 10),
        sort_order: r.length + 1,
      },
    ]);
  }
  async function saveRow(row: Row) {
    setBusy(true);
    try {
      const payload: any = { ...row };
      if (!payload.last_updated) payload.last_updated = new Date().toISOString().slice(0, 10);
      const { error } = row.id
        ? await supabase.from("community_leaderboard").update(payload).eq("id", row.id)
        : await supabase.from("community_leaderboard").insert(payload);
      if (error) throw error;
      toast({ title: "Saved" });
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }
  async function deleteRow(row: Row) {
    if (!row.id || !confirm(`Delete ${row.username}?`)) return;
    const { error } = await supabase.from("community_leaderboard").delete().eq("id", row.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); load(); }
  }

  async function publishSnapshot() {
    if (!confirm("Publish snapshot? All current rows will become publicly visible with today's date.")) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const today = now.slice(0, 10);
      const { error } = await supabase
        .from("community_leaderboard")
        .update({ published_at: now, last_updated: today })
        .not("id", "is", null);
      if (error) throw error;
      toast({ title: "Snapshot published" });
      await load();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  function defaultPointsFor(cat: Submission["category"]) {
    const map: Record<string, number> = { raid: 10, meme: 15, thread: 25, video: 40 };
    return map[cat] ?? 10;
  }

  async function approveSubmission(s: Submission) {
    const pts = pointsDraft[s.id] ?? defaultPointsFor(s.category);
    if (!Number.isFinite(pts) || pts < 0) {
      toast({ title: "Enter valid points", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("community_submission_approve", {
        _submission_id: s.id, _points: pts, _notes: notesDraft[s.id] || null,
      });
      if (error) throw error;
      toast({ title: `Approved · +${pts} pts to ${s.handle}` });
      await load();
    } catch (e: any) {
      toast({ title: "Approve failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  async function rejectSubmission(s: Submission) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("community_submission_reject", {
        _submission_id: s.id, _notes: notesDraft[s.id] || null,
      });
      if (error) throw error;
      toast({ title: "Rejected" });
      await load();
    } catch (e: any) {
      toast({ title: "Reject failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  if (!canEdit) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          You need the <code className="px-1 rounded bg-muted">admin</code> or{" "}
          <code className="px-1 rounded bg-muted">marketing</code> role to edit the community leaderboard.
        </p>
      </div>
    );
  }

  const pendingCount = subs.filter((s) => s.status === "pending").length;
  const filteredProfiles = profiles.filter((p) => {
    if (!profileFilter.trim()) return true;
    const q = profileFilter.toLowerCase();
    return [p.display_name, p.community_username, p.email, p.payment_email, p.social_handle]
      .some((v) => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review submissions, manage leaderboard entries, and browse community profiles. Publish a snapshot to push changes live.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/leaderboard.html" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><ExternalLink size={14} /> Open public page</Button>
          </a>
          <Button onClick={publishSnapshot} disabled={busy} size="sm">Publish snapshot</Button>
        </div>
      </div>

      <Tabs defaultValue="submissions" className="space-y-5">
        <TabsList>
          <TabsTrigger value="submissions">
            Submissions{pendingCount > 0 && <span className="ml-1.5 text-xs">({pendingCount})</span>}
          </TabsTrigger>
          <TabsTrigger value="entries">Entries ({rows.length})</TabsTrigger>
          <TabsTrigger value="users">Users ({profiles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="space-y-3">
        {subs.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-card">
            No community submissions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => {
              const isPending = s.status === "pending";
              const isEditing = editingSub === s.id;
              const showForm = isPending || isEditing;
              return (
                <div key={s.id} className="border border-border rounded-lg p-3 bg-card grid gap-2 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-3">
                    <div className="text-sm font-medium">{s.handle}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.category}</div>
                  </div>
                  <a
                    href={s.post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="sm:col-span-5 text-xs text-muted-foreground hover:text-foreground truncate"
                  >
                    {s.post_url}
                  </a>
                  {showForm ? (
                    <>
                      <Input
                        type="number"
                        className="sm:col-span-1"
                        placeholder={String(s.awarded_points || defaultPointsFor(s.category))}
                        value={pointsDraft[s.id] ?? ""}
                        onChange={(e) => setPointsDraft((p) => ({ ...p, [s.id]: +e.target.value }))}
                      />
                      <Input
                        className="sm:col-span-2"
                        placeholder={s.reviewer_notes || "Note (optional)"}
                        value={notesDraft[s.id] ?? ""}
                        onChange={(e) => setNotesDraft((p) => ({ ...p, [s.id]: e.target.value }))}
                      />
                      <div className="sm:col-span-1 flex gap-1 justify-end">
                        <Button size="sm" onClick={async () => { await approveSubmission(s); setEditingSub(null); }} disabled={busy}><Check size={14} /></Button>
                        <Button size="sm" variant="outline" onClick={() => rejectSubmission(s)} disabled={busy}><X size={14} /></Button>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
                      <div className="text-right">
                        <span className={s.status === "approved" ? "text-foreground font-medium" : ""}>
                          {s.status === "approved" ? `Approved · +${s.awarded_points} pts` : "Rejected"}
                        </span>
                        {s.reviewer_notes && <span className="block italic">{s.reviewer_notes}</span>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingSub(s.id); setPointsDraft((p) => ({ ...p, [s.id]: s.awarded_points || defaultPointsFor(s.category) })); }}>
                        <Pencil size={12} />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </TabsContent>

        <TabsContent value="entries" className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Approving a submission auto-bumps points. Use manual edits for corrections only.
          </p>
          <Button onClick={addRow} variant="outline" size="sm"><Plus size={14} /> Add user</Button>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="border border-border rounded-lg p-3 bg-card space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[180px]">
                    <Label className="text-[10px]">Handle</Label>
                    <Input value={r.username} onChange={(e) => updateRow(i, { username: e.target.value })} />
                  </div>
                  <div className="w-20">
                    <Label className="text-[10px]">Points</Label>
                    <Input type="number" value={r.points} onChange={(e) => updateRow(i, { points: +e.target.value })} />
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <Button onClick={() => saveRow(r)} size="sm" disabled={busy}><Save size={14} /> Save</Button>
                    {r.id && <Button onClick={() => deleteRow(r)} size="sm" variant="outline"><Trash2 size={14} /></Button>}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div><Label className="text-[10px]">Raids</Label><Input type="number" value={r.raids} onChange={(e) => updateRow(i, { raids: +e.target.value })} /></div>
                  <div><Label className="text-[10px]">Memes</Label><Input type="number" value={r.memes} onChange={(e) => updateRow(i, { memes: +e.target.value })} /></div>
                  <div><Label className="text-[10px]">Threads</Label><Input type="number" value={r.edu_threads} onChange={(e) => updateRow(i, { edu_threads: +e.target.value })} /></div>
                  <div><Label className="text-[10px]">Videos</Label><Input type="number" value={r.videos} onChange={(e) => updateRow(i, { videos: +e.target.value })} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
        </TabsContent>

        <TabsContent value="users" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Input
              placeholder="Search handle, email, payment address…"
              value={profileFilter}
              onChange={(e) => setProfileFilter(e.target.value)}
              className="max-w-sm"
            />
            <span className="text-xs text-muted-foreground">{filteredProfiles.length} / {profiles.length}</span>
          </div>
          {filteredProfiles.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-card">
              No matching profiles.
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card divide-y divide-border overflow-hidden">
              {filteredProfiles.map((p) => {
                const socials = parseSocials(p.social_handle);
                const socialLabels: { key: keyof Socials; label: string }[] = [
                  { key: "x", label: "X" }, { key: "ig", label: "IG" }, { key: "tt", label: "TT" }, { key: "yt", label: "YT" },
                ];
                return (
                  <div key={p.id} className="p-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3 text-sm">
                    <div className="lg:w-44 min-w-0">
                      <div className="font-medium truncate">{p.community_username || p.display_name || "—"}</div>
                      {p.display_name && p.community_username && (
                        <div className="text-[11px] text-muted-foreground truncate">{p.display_name}</div>
                      )}
                    </div>
                    <div className="lg:flex-1 min-w-0 text-xs text-muted-foreground truncate" title={p.email || ""}>
                      <span className="uppercase tracking-widest text-[9px] mr-1">email</span>{p.email || "—"}
                    </div>
                    <div className="lg:flex-1 min-w-0 text-xs text-muted-foreground truncate" title={p.payment_email || ""}>
                      <span className="uppercase tracking-widest text-[9px] mr-1">pay</span>{p.payment_email || "—"}
                    </div>
                    <div className="lg:w-56 min-w-0 flex flex-wrap gap-1">
                      {socialLabels.filter((s) => socials[s.key]).length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : socialLabels.filter((s) => socials[s.key]).map((s) => (
                        <span key={s.key} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80 max-w-[150px] truncate">
                          <span className="font-semibold mr-1">{s.label}</span>{socials[s.key]}
                        </span>
                      ))}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => openEditProfile(p)} className="self-start lg:self-auto">
                      <Pencil size={12} /> Edit
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingProfile} onOpenChange={(o) => !o && setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit community profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Username</Label><Input value={editDraft.username} onChange={(e) => setEditDraft((d) => ({ ...d, username: e.target.value }))} /></div>
            <div><Label className="text-xs">Contact email</Label><Input type="email" value={editDraft.email} onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))} /></div>
            <div><Label className="text-xs">Payment email / address</Label><Input value={editDraft.pay} onChange={(e) => setEditDraft((d) => ({ ...d, pay: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              {([["x","X / Twitter"],["ig","Instagram"],["tt","TikTok"],["yt","YouTube"]] as const).map(([k, label]) => (
                <div key={k}>
                  <Label className="text-xs">{label}</Label>
                  <Input value={(editDraft.socials as any)[k] || ""} onChange={(e) => setEditDraft((d) => ({ ...d, socials: { ...d.socials, [k]: e.target.value } }))} placeholder="@handle" />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Changing the contact email here only updates the profile row. The user's login email is managed by auth and they can change it from their account.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancel</Button>
            <Button onClick={saveProfileEdit} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}