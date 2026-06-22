import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, ExternalLink } from "lucide-react";

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

type Challenge = {
  id?: string;
  week_label: string;
  theme: string;
  description?: string | null;
  multiplier: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

type Rule = {
  id: string;
  activity: string;
  base_points: number;
  notes?: string | null;
  sort_order: number;
};

export default function Leaderboard() {
  const { roles, isAdmin } = useAuth();
  const canEdit = isAdmin || roles.includes("marketing" as any);

  const [rows, setRows] = useState<Row[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const [a, b, c] = await Promise.all([
      supabase.from("community_leaderboard").select("*").order("points", { ascending: false }),
      supabase.from("community_challenges").select("*").order("start_date", { ascending: true }),
      supabase.from("community_points_rules").select("*").order("sort_order", { ascending: true }),
    ]);
    if (a.data) setRows(a.data as any);
    if (b.data) setChallenges(b.data as any);
    if (c.data) setRules(c.data as any);
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

  function updateChallenge(i: number, patch: Partial<Challenge>) {
    setChallenges((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  async function saveChallenge(ch: Challenge) {
    setBusy(true);
    try {
      const { error } = ch.id
        ? await supabase.from("community_challenges").update(ch).eq("id", ch.id)
        : await supabase.from("community_challenges").insert(ch);
      if (error) throw error;
      toast({ title: "Saved" });
      await load();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }
  async function setActiveChallenge(ch: Challenge) {
    setBusy(true);
    try {
      // Clear all then set one as active.
      await supabase.from("community_challenges").update({ is_active: false }).not("id", "is", null);
      await supabase.from("community_challenges").update({ is_active: true }).eq("id", ch.id!);
      toast({ title: `${ch.week_label} is now active` });
      await load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Community Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit weekly points, rotate challenges, and publish a snapshot to push the public view live.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/leaderboard.html" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm"><ExternalLink size={14} /> Open public page</Button>
          </a>
          <Button onClick={publishSnapshot} disabled={busy} size="sm">Publish snapshot</Button>
        </div>
      </div>

      {/* Leaderboard rows */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Entries</h2>
          <Button onClick={addRow} variant="outline" size="sm"><Plus size={14} /> Add user</Button>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="grid grid-cols-12 gap-2 items-end border border-border rounded-lg p-3 bg-card">
                <div className="col-span-12 sm:col-span-3">
                  <Label className="text-[10px]">Username</Label>
                  <Input value={r.username} onChange={(e) => updateRow(i, { username: e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-[10px]">Points</Label>
                  <Input type="number" value={r.points} onChange={(e) => updateRow(i, { points: +e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-[10px]">Raids</Label>
                  <Input type="number" value={r.raids} onChange={(e) => updateRow(i, { raids: +e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-[10px]">Memes</Label>
                  <Input type="number" value={r.memes} onChange={(e) => updateRow(i, { memes: +e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-[10px]">Threads</Label>
                  <Input type="number" value={r.edu_threads} onChange={(e) => updateRow(i, { edu_threads: +e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-[10px]">Videos</Label>
                  <Input type="number" value={r.videos} onChange={(e) => updateRow(i, { videos: +e.target.value })} />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <Label className="text-[10px]">Done</Label>
                  <Input type="number" value={r.challenges_completed} onChange={(e) => updateRow(i, { challenges_completed: +e.target.value })} />
                </div>
                <div className="col-span-6 sm:col-span-3 flex gap-2 justify-end">
                  <Button onClick={() => saveRow(r)} size="sm" disabled={busy}><Save size={14} /> Save</Button>
                  {r.id && <Button onClick={() => deleteRow(r)} size="sm" variant="outline"><Trash2 size={14} /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Challenges */}
      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Weekly challenges</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {challenges.map((c, i) => (
            <div key={c.id ?? `c-${i}`} className="border border-border rounded-lg p-4 bg-card space-y-2">
              <div className="flex items-center justify-between">
                <Input className="max-w-[120px]" value={c.week_label} onChange={(e) => updateChallenge(i, { week_label: e.target.value })} />
                {c.is_active && <span className="text-[11px] uppercase tracking-widest text-primary">Active</span>}
              </div>
              <Input placeholder="Theme" value={c.theme} onChange={(e) => updateChallenge(i, { theme: e.target.value })} />
              <Textarea placeholder="Description" rows={2} value={c.description ?? ""} onChange={(e) => updateChallenge(i, { description: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-[10px]">Multiplier</Label><Input type="number" step="0.1" value={c.multiplier} onChange={(e) => updateChallenge(i, { multiplier: +e.target.value })} /></div>
                <div><Label className="text-[10px]">Start</Label><Input type="date" value={c.start_date} onChange={(e) => updateChallenge(i, { start_date: e.target.value })} /></div>
                <div><Label className="text-[10px]">End</Label><Input type="date" value={c.end_date} onChange={(e) => updateChallenge(i, { end_date: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                {!c.is_active && c.id && (
                  <Button onClick={() => setActiveChallenge(c)} size="sm" variant="outline">Mark active</Button>
                )}
                <Button onClick={() => saveChallenge(c)} size="sm" disabled={busy}><Save size={14} /> Save</Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rules (reference) */}
      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-widest text-muted-foreground">Points rules (reference)</h2>
        <div className="border border-border rounded-lg bg-card divide-y divide-border">
          {rules.map((r) => (
            <div key={r.id} className="p-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{r.activity}</div>
                {r.notes && <div className="text-xs text-muted-foreground">{r.notes}</div>}
              </div>
              <div className="text-sm font-semibold tabular-nums">+{r.base_points}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}