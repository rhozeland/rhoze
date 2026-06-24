import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, ExternalLink, Check, X } from "lucide-react";

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

export default function Leaderboard() {
  const { roles, isAdmin } = useAuth();
  const canEdit = isAdmin || roles.includes("marketing" as any);

  const [rows, setRows] = useState<Row[]>([]);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [pointsDraft, setPointsDraft] = useState<Record<string, number>>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [a, d] = await Promise.all([
      supabase.from("community_leaderboard").select("*").order("points", { ascending: false }),
      supabase.from("community_submissions").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (a.data) setRows(a.data as any);
    if (d.data) setSubs(d.data as any);
    setLoading(false);
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

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Community Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Approve community submissions, edit weekly points, then publish a snapshot to push the public page live. Mirrors the public leaderboard exactly.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href="/leaderboard.html" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><ExternalLink size={14} /> Open public page</Button>
          </a>
          <Button onClick={publishSnapshot} disabled={busy} size="sm">Publish snapshot</Button>
        </div>
      </div>

      {/* Incoming submissions */}
      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground">
          Incoming submissions{subs.filter((s) => s.status === "pending").length > 0 && (
            <span className="ml-2 text-foreground">({subs.filter((s) => s.status === "pending").length} pending)</span>
          )}
        </h2>
        {subs.length === 0 ? (
          <div className="text-sm text-muted-foreground border border-border rounded-lg p-4 bg-card">
            No community submissions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => {
              const isPending = s.status === "pending";
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
                  {isPending ? (
                    <>
                      <Input
                        type="number"
                        className="sm:col-span-1"
                        placeholder={String(defaultPointsFor(s.category))}
                        value={pointsDraft[s.id] ?? ""}
                        onChange={(e) => setPointsDraft((p) => ({ ...p, [s.id]: +e.target.value }))}
                      />
                      <Input
                        className="sm:col-span-2"
                        placeholder="Note (optional)"
                        value={notesDraft[s.id] ?? ""}
                        onChange={(e) => setNotesDraft((p) => ({ ...p, [s.id]: e.target.value }))}
                      />
                      <div className="sm:col-span-1 flex gap-1 justify-end">
                        <Button size="sm" onClick={() => approveSubmission(s)} disabled={busy}><Check size={14} /></Button>
                        <Button size="sm" variant="outline" onClick={() => rejectSubmission(s)} disabled={busy}><X size={14} /></Button>
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-4 text-right text-xs text-muted-foreground">
                      <span className={s.status === "approved" ? "text-foreground font-medium" : ""}>
                        {s.status === "approved" ? `Approved · +${s.awarded_points} pts` : "Rejected"}
                      </span>
                      {s.reviewer_notes && <span className="block italic">{s.reviewer_notes}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Leaderboard rows */}
      <section className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Entries</h2>
          <Button onClick={addRow} variant="outline" size="sm"><Plus size={14} /> Add user</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Existing community member? Their row updates in place by handle. Approving a submission auto-bumps points — manual edits are for corrections.
        </p>
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
      </section>
    </div>
  );
}