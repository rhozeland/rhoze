// Dashboard tab — welcome, progress, current projects, community, quick actions.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Coins, Plus, Star, Trophy, Users } from "lucide-react";

type Proj = { id: string; title: string; status: string; credit_balance: number | null };
type Row = { username: string; points: number };
type Req = { id: string; title: string; proposed_project_title: string | null; status: string; estimated_credits: number | null; requested_credits: number };

export default function DashboardHome({
  session, onBuild, onRoadmap, onTokens, onOpenProject,
}: {
  session: Session;
  onBuild: () => void; onRoadmap: () => void; onTokens: () => void;
  onOpenProject?: (requestId: string) => void;
}) {
  const [projects, setProjects] = useState<Proj[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [balance, setBalance] = useState(0);
  const [earned, setEarned] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [board, setBoard] = useState<Row[]>([]);
  const [community, setCommunity] = useState<{ title: string; meta: string }[]>([]);

  useEffect(() => {
    (async () => {
      const { data: reqs } = await supabase
        .from("credit_requests")
        .select("id,title,proposed_project_title,status,estimated_credits,requested_credits")
        .eq("requested_by", session.user.id)
        .order("created_at", { ascending: false })
        .limit(8);
      setRequests((reqs ?? []) as Req[]);
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

  const pct = Math.min(100, Math.round((xp / nextXp) * 100));

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      {/* MAIN COLUMN */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Header strip: identity + level + inline stats + actions */}
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-muted grid place-items-center text-base uppercase shrink-0">
              {name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl md:text-2xl tracking-tight truncate">{name}</h2>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="w-3.5 h-3.5" /> Level {level} · {xp.toLocaleString()}/{nextXp.toLocaleString()} XP
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={onBuild}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-3 py-2 text-xs font-medium">
                <Plus className="w-3.5 h-3.5" /> New project
              </button>
              <button onClick={onTokens}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs hover:border-foreground/30">
                <Coins className="w-3.5 h-3.5" /> $RHOZE
              </button>
            </div>
          </div>
          <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 divide-x divide-border rounded-xl border border-border">
            <Stat label="Projects done" value={String(completed)} />
            <Stat label="Credits" value={balance.toLocaleString()} />
            <Stat label="Rank" value={rank >= 0 ? `#${rank + 1}` : "—"} />
          </div>
        </section>

        {/* Projects */}
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Your projects</div>
            <button onClick={onRoadmap} className="text-xs underline underline-offset-4">Roadmap</button>
          </div>
          {projects.length === 0 && requests.length === 0 ? (
            <button onClick={onBuild}
              className="w-full rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-foreground/30 transition">
              No projects yet — start your first brief
            </button>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((r) => (
                <button key={r.id} onClick={() => onOpenProject?.(r.id)}
                  className="w-full text-left py-3 first:pt-0 last:pb-0 group">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate group-hover:underline underline-offset-4">
                        {r.proposed_project_title || r.title}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {String(r.status).replace(/_/g, " ")} · {(r.estimated_credits ?? r.requested_credits ?? 0).toLocaleString()} credits
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                </button>
              ))}
              {projects.slice(0, 5).map((p) => (
                <button key={p.id} onClick={onRoadmap}
                  className="w-full text-left py-3 first:pt-0 last:pb-0 group">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate group-hover:underline underline-offset-4">{p.title}</div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.status}</div>
                    </div>
                    <div className="w-24 shrink-0">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-foreground" style={{ width: `${progress[p.id] ?? 0}%` }} />
                      </div>
                    </div>
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{progress[p.id] ?? 0}%</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Signals */}
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-3">From the network</div>
          {community.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nothing new yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {community.map((c, i) => (
                <div key={i} className="py-2.5 first:pt-0 last:pb-0 flex items-baseline gap-3">
                  <span className="text-sm flex-1 min-w-0 truncate">{c.title}</span>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{c.meta}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* RAIL */}
      <aside className="flex flex-col gap-3 min-w-0">
        <div className="rounded-2xl border border-border bg-foreground text-background p-5">
          <div className="text-[11px] tracking-[0.25em] uppercase opacity-70">Studio credits</div>
          <div className="mt-1 text-3xl tabular-nums">{balance.toLocaleString()}</div>
          <p className="mt-2 text-xs opacity-70 leading-relaxed">
            Spend on shoots, merch drops and community access.
          </p>
          <button onClick={onTokens}
            className="mt-4 w-full rounded-xl bg-background text-foreground py-2 text-sm font-medium">
            Manage $RHOZE
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-1.5 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </div>
          <div className="mt-3 space-y-2">
            {board.length === 0 && <div className="text-sm text-muted-foreground">Updating…</div>}
            {board.map((b, i) => (
              <div key={b.username} className="flex items-center gap-2.5 text-sm">
                <span className="w-4 text-muted-foreground tabular-nums text-xs">{i + 1}</span>
                <span className="truncate flex-1">{b.username}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{b.points.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button onClick={() => window.open("/leaderboard.html", "_blank")}
            className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs hover:border-foreground/30">
            <Users className="w-3.5 h-3.5" /> Full board
          </button>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
      <div className="mt-0.5 text-lg tabular-nums">{value}</div>
    </div>
  );
}
