import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { formatCents } from "../lib/format";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Client landing — lists every project the signed-in user has been linked
 * to via `project_clients`. Each row links into the client portal view.
 */
export default function ClientHome() {
  const { loading, session, user } = useAuth();

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

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/client" replace />;

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland</div>
          <h1 className="text-2xl font-semibold mt-1">Your projects</h1>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/client/requests"><Plus size={14} className="mr-1" /> New request</Link>
        </Button>
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
          {(projects ?? []).map((p: any) => (
            <li key={p.id}>
              <Link
                to={`/portal/${p.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {p.client_name} · {p.status} · {formatCents(p.dollar_balance_cents)} · {p.credit_balance ?? 0} cr
                  </div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}