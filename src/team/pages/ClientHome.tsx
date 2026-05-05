import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { formatCents } from "../lib/format";
import { ChevronRight, Sparkles, Plus, ChevronDown } from "lucide-react";
import CreditRequestsPanel from "../components/CreditRequestsPanel";

/**
 * Client landing — lists every project the signed-in user has been linked
 * to via `project_clients`. Each row links into the client portal view.
 */
export default function ClientHome() {
  const { loading, session, user } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["client_projects", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // RLS already restricts `projects` to is_project_member, so a plain
      // select returns just the user's accessible projects.
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,client_name,status,dollar_balance_cents,credit_balance,project_code")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ids = (projects ?? []).map((p: any) => p.id);
  const { data: balances } = useQuery({
    queryKey: ["client_rhoze_balances", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("rhoze_balances")
        .select("project_id,balance,lifetime_earned")
        .in("project_id", ids);
      return Object.fromEntries((data ?? []).map((r: any) => [r.project_id, r]));
    },
  });

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/client" replace />;

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland</div>
        <h1 className="text-2xl font-semibold mt-1">Your projects</h1>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading projects…</div>
      ) : (projects ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No projects on file yet. If you have a project code, redeem it from{" "}
          <Link to="/client" className="underline">the access page</Link>.
        </div>
      ) : (
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {(projects ?? []).map((p: any) => {
            const rb = balances?.[p.id];
            const isOpen = expanded === p.id;
            return (
            <li key={p.id}>
              <div className="flex items-center justify-between gap-3 p-4 hover:bg-accent/40 transition-colors">
                <Link to={`/portal/${p.id}`} className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {p.client_name} · {p.status} · {formatCents(p.dollar_balance_cents)} · {p.credit_balance ?? 0} cr
                  </div>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden sm:flex items-center gap-1 text-[11px] tabular-nums px-2 py-1 rounded-md bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
                    <Sparkles size={11} /> {Number(rb?.balance ?? 0).toLocaleString()} $RHOZE
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : p.id)}
                    className="text-[11px] inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-accent transition"
                  >
                    <Plus size={11} /> Request work
                    <ChevronDown size={11} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <Link to={`/portal/${p.id}`} aria-label="Open project">
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </Link>
                </div>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 bg-muted/30">
                  <CreditRequestsPanel
                    projectId={p.id}
                    creditBalance={p.credit_balance ?? 0}
                    mode="client"
                  />
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}