// Dashboard tab — welcome, progress, current projects, community, quick actions.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Coins, Plus, Star, Trophy, Users } from "lucide-react";

type Proj = { id: string; title: string; status: string; credit_balance: number | null };
type Row = { username: string; points: number };

export default function DashboardHome({
  session, onBuild, onRoadmap, onTokens,
}: {
  session: Session;
  onBuild: () => void; onRoadmap: () => void; onTokens: () => void;
}) {
  const [projects, setProjects] = useState<Proj[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [balance, setBalance] = useState(0);
  const [earned, setEarned] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [board, setBoard] = useState<Row[]>([]);
  const [community, setCommunity] = useState<{ title: string; meta: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: pcs } = await supabase.from("project_clients").select("project_id").eq("user_id", session.user.id);
      const ids = (pcs ?? []).map((r) => r.project_id);
      if (ids.length) {
        const { data: prj } = await supabase.from("projects").select("id,title,status,credit_balance").in("id", ids);
        const rows = (prj ?? []) as Proj[];
        setProjects(rows);
        setCompleted(rows.filter((p) => p.status === "complete" || p.status === "completed").length);
        const { data: ms } = await supabase.from("project_milestones").select("project_id,status").in("project_id", ids);
        const map: Record<string, number> = {};
        ids.forEach((id) => {
          const mine = (ms ?? []).filter((m: any) => m.project_id === id);
          map[id] = mine.length ? Math.round((mine.filter((m: any) => m.status === "approved" || m.status === "complete").length / mine.length) * 100) : 0;
        });
        setProgress(map);
        const { data: bals } = await supabase.from("rhoze_balances").select("balance").in("project_id", ids);
        setBalance((bals ?? []).reduce((a, r: any) => a + Number(r.balance ?? 0), 0));
        const { data: led } = await supabase.from("rhoze_ledger").select("delta").in("project_id", ids);
        setEarned((led ?? []).filter((l: any) => Number(l.delta) > 0).reduce((a, l: any) => a + Number(l.delta), 0));
      }
      const { data: lb } = await supabase.from("community_leaderboard").select("username,points")
        .not("published_at", "is", null).order("points", { ascending: false }).limit(5);
      setBoard((lb ?? []) as Row[]);
      const { data: news } = await supabase.from("news_ticker_items").select("headline,label,created_at")
        .eq("is_active", true).order("sort_order", { ascending: true }).limit(3);
      setCommunity((news ?? []).map((n: any) => ({
        title: n.headline, meta: n.label ?? new Date(n.created_at).toLocaleDateString(),
      })));
    })();
  }, [session.user.id]);

  const name = (session.user.user_metadata?.full_name as string) || session.user.email?.split("@")[0] || "Creator";
  const xp = earned || balance;
  const level = Math.max(1, Math.floor(xp / 1000) + 1);
  const nextXp = level * 1000;
  const rank = board.findIndex((b) => b.username.toLowerCase() === String(name).toLowerCase());

  return (
    <div className="space-y-4">
      {/* Welcome + stats */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Welcome back</div>
              <h2 className="text-2xl md:text-3xl tracking-tight mt-1 truncate">{name}</h2>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="w-3.5 h-3.5" /> Creator Level · Level {level}
              </div>
            </div>
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg uppercase shrink-0">
              {name.slice(0, 1)}
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>XP progress</span>
              <span className="tabular-nums">{xp.toLocaleString()} / {nextXp.toLocaleString()} XP</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-foreground" style={{ width: `${Math.min(100, (xp / nextXp) * 100)}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
              {Math.max(0, nextXp - xp).toLocaleString()} XP to next level
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
          <Stat label="Projects completed" value={String(completed)} />
          <Stat label="$RHOZE balance" value={balance.toLocaleString()} />
          <Stat label="Community rank" value={rank >= 0 ? `#${rank + 1}` : "—"} />
        </div>
      </div>

      {/* Current projects */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Current projects</div>
          <button onClick={onRoadmap} className="text-xs underline underline-offset-4">View all</button>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No projects yet — start one from the Build tab.
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-3">
            {projects.slice(0, 6).map((p) => (
              <button key={p.id} onClick={onRoadmap}
                className="text-left rounded-2xl border border-border bg-card p-4 hover:border-foreground/30 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <span className="text-[10px] uppercase tracking-wider rounded-full bg-muted px-2 py-0.5 shrink-0">{p.status}</span>
                </div>
                <div className="mt-4 flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span><span className="tabular-nums">{progress[p.id] ?? 0}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-foreground" style={{ width: `${progress[p.id] ?? 0}%` }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">$RHOZE balance</div>
          <div className="mt-2 text-3xl tabular-nums">{balance.toLocaleString()}</div>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>Creative services</li><li>Clothing purchases</li>
            <li>Community access</li><li>Investments</li>
          </ul>
          <button onClick={onTokens} className="mt-4 w-full rounded-xl border border-border py-2 text-sm hover:border-foreground/30">
            Manage $RHOZE
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-1.5 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            <Trophy className="w-3.5 h-3.5" /> Community leaderboard
          </div>
          <div className="mt-3 space-y-2">
            {board.length === 0 && <div className="text-sm text-muted-foreground">Leaderboard updating…</div>}
            {board.map((b, i) => (
              <div key={b.username} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="w-6 h-6 rounded-full bg-muted shrink-0" />
                <span className="truncate flex-1">{b.username}</span>
                <span className="tabular-nums text-muted-foreground">{b.points.toLocaleString()} XP</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Quick actions</div>
            <div className="mt-3 space-y-2">
              <Action icon={<Plus className="w-4 h-4" />} label="Start a project" onClick={onBuild} />
              <Action icon={<Coins className="w-4 h-4" />} label="Buy $RHOZE" onClick={() => window.open("/invest.html", "_blank")} />
              <Action icon={<Users className="w-4 h-4" />} label="Join community" onClick={() => window.open("/leaderboard.html", "_blank")} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Recent community</div>
            <div className="mt-3 space-y-2.5">
              {community.length === 0 && <div className="text-sm text-muted-foreground">Nothing new yet.</div>}
              {community.map((c, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-muted shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm truncate">{c.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl tabular-nums">{value}</div>
    </div>
  );
}

function Action({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm hover:border-foreground/30 transition">
      {icon}<span className="flex-1 text-left">{label}</span><ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
    </button>
  );
}
