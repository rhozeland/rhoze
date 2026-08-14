// Dashboard tab — welcome, progress, current projects, community, quick actions.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Coins, FolderOpen, Plus, Star, Trophy, Users } from "lucide-react";

type Proj = { id: string; title: string; status: string; credit_balance: number | null };
type Row = { username: string; points: number };
type Req = { id: string; title: string; proposed_project_title: string | null; status: string; estimated_credits: number | null; requested_credits: number; created_at?: string };

// Human-readable status labels + tone.
const STATUS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending review",
  pending_review: "Pending review",
  submitted: "Pending review",
  in_review: "Pending review",
  estimated: "Estimated",
  approved: "Confirmed",
  confirmed: "Confirmed",
  active: "In progress",
  in_progress: "In progress",
  complete: "Completed",
  completed: "Completed",
  rejected: "Declined",
};
const niceStatus = (s: string) => STATUS[String(s).toLowerCase()] ?? String(s).replace(/_/g, " ");

function StatusPill({ status }: { status: string }) {
  const k = String(status).toLowerCase();
  const done = k.startsWith("complete") || k === "approved" || k === "confirmed";
  const live = k === "active" || k === "in_progress";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
        done
          ? "border-primary/40 bg-primary/10 text-foreground"
          : live
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border text-muted-foreground"
      }`}
    >
      {niceStatus(status)}
    </span>
  );
}

const relTime = (iso?: string) => {
  if (!iso) return "—";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 30) return `${Math.floor(d)}d ago`;
  return new Date(iso).toLocaleDateString();
};

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
        .select("id,title,proposed_project_title,status,estimated_credits,requested_credits,created_at")
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

  const active = requests[0] ?? null;

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      {/* MAIN COLUMN — projects first */}
      <div className="flex flex-col gap-3 min-w-0">
        {/* Compact account bar */}
        <section className="rounded-2xl border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-sm uppercase shrink-0">
            {name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{name}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Star className="w-3 h-3" /> Level {level} · {xp.toLocaleString()}/{nextXp.toLocaleString()} XP
              <span className="hidden sm:inline">· {balance.toLocaleString()} credits</span>
              <span className="hidden sm:inline">· {completed} done</span>
              <span className="hidden sm:inline">· {rank >= 0 ? `#${rank + 1}` : "unranked"}</span>
            </div>
          </div>
          <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
            <div className="h-full bg-foreground transition-all" style={{ width: `${pct}%` }} />
          </div>
          <button onClick={onBuild}
            className="inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-3 py-2 text-xs font-medium">
            <Plus className="w-3.5 h-3.5" /> New project
          </button>
        </section>

        {/* Continue where you left off */}
        {active && (
          <button onClick={() => onOpenProject?.(active.id)}
            className="text-left rounded-2xl border border-foreground/20 bg-card p-4 md:p-5 hover:border-foreground/40 transition group">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Continue where you left off</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-lg md:text-xl tracking-tight truncate group-hover:underline underline-offset-4">
                  {active.proposed_project_title || active.title}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <StatusPill status={active.status} />
                  <span>{(active.estimated_credits ?? active.requested_credits ?? 0).toLocaleString()} credits</span>
                  <span>· updated {relTime(active.created_at)}</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-foreground text-background px-3 py-2 text-xs font-medium shrink-0">
                Continue project <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        )}

        {/* Projects — the hub */}
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <div className="flex items-center gap-1.5 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
              <FolderOpen className="w-3.5 h-3.5" /> Your projects
            </div>
            <button onClick={onRoadmap} className="text-xs underline underline-offset-4 text-muted-foreground hover:text-foreground">Roadmap</button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            This is where your projects live — open one any time to review the brief, estimate and status.
          </p>

          {projects.length === 0 && requests.length === 0 ? (
            <button onClick={onBuild}
              className="w-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground hover:border-foreground/30 transition">
              No projects yet — start your first brief
            </button>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {requests.map((r) => (
                <button key={r.id} onClick={() => onOpenProject?.(r.id)}
                  className="text-left rounded-xl border border-border bg-background p-4 hover:border-foreground/30 hover:shadow-sm transition group flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium leading-snug group-hover:underline underline-offset-4 line-clamp-2">
                      {r.proposed_project_title || r.title}
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">
                    {r.title.replace(/ — new project$/, "")}
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-2">
                    <div>
                      <div className="text-lg tabular-nums leading-none">
                        {(r.estimated_credits ?? r.requested_credits ?? 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">credits · {relTime(r.created_at)}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-foreground">
                      View project <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))}

              {projects.slice(0, 6).map((p) => (
                <button key={p.id} onClick={onRoadmap}
                  className="text-left rounded-xl border border-border bg-background p-4 hover:border-foreground/30 hover:shadow-sm transition group flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium leading-snug group-hover:underline underline-offset-4 line-clamp-2">{p.title}</div>
                    <StatusPill status={p.status} />
                  </div>
                  <div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-foreground" style={{ width: `${progress[p.id] ?? 0}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{progress[p.id] ?? 0}% complete</div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {(p.credit_balance ?? 0).toLocaleString()} credits
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-foreground">
                      View project <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* RAIL — secondary */}
      <aside className="flex flex-col gap-3 min-w-0">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Studio credits</div>
          <div className="mt-1 text-2xl tabular-nums">{balance.toLocaleString()}</div>
          <button onClick={onTokens}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs hover:border-foreground/30">
            <Coins className="w-3.5 h-3.5" /> Manage $RHOZE
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[11px] tracking-[0.25em] uppercase text-muted-foreground">
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </div>
          <div className="mt-3 space-y-1.5">
            {board.length === 0 && <div className="text-xs text-muted-foreground">Updating…</div>}
            {board.slice(0, 5).map((b, i) => (
              <div key={b.username} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span className="w-3 tabular-nums">{i + 1}</span>
                <span className="truncate flex-1 text-foreground">{b.username}</span>
                <span className="tabular-nums">{b.points.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button onClick={() => window.open("/leaderboard.html", "_blank")}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs hover:border-foreground/30">
            <Users className="w-3.5 h-3.5" /> Full board
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-2">From the network</div>
          {community.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nothing new yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {community.map((c, i) => (
                <div key={i} className="py-2 first:pt-0 last:pb-0">
                  <div className="text-xs leading-snug">{c.title}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{c.meta}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
