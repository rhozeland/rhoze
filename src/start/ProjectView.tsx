// Project page — the destination after a Build confirmation, and the page a
// project reopens into from the Dashboard. Reads the existing credit_request.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, Calendar, Check, Plus, Target, Wallet } from "lucide-react";

type Req = {
  id: string;
  title: string;
  proposed_project_title: string | null;
  description: string | null;
  requested_credits: number;
  estimated_credits: number | null;
  status: string;
  created_at: string;
  project_id: string | null;
};

// The Build flow writes a structured description; read it back out.
function parseBrief(desc: string | null) {
  const text = desc ?? "";
  const grab = (key: string) => {
    const m = text.match(new RegExp(`^${key}:\\s*(.+)$`, "mi"));
    return m ? m[1].trim() : "";
  };
  const summary = text.split("\n")[0]?.trim() ?? "";
  return {
    summary,
    goals: grab("Goals"),
    timeline: grab("Timeline"),
    budget: grab("Budget"),
    notes: grab("Notes"),
    estimate: grab("Estimate"),
  };
}

const CAD_PER_CREDIT = 75;

export default function ProjectView({
  session, requestId, justCreated, onBack, onBuild,
}: {
  session: Session | null;
  requestId: string;
  justCreated?: boolean;
  onBack: () => void;
  onBuild: () => void;
}) {
  const [req, setReq] = useState<Req | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("credit_requests")
        .select("id,title,proposed_project_title,description,requested_credits,estimated_credits,status,created_at,project_id")
        .eq("id", requestId)
        .maybeSingle();
      if (alive) { setReq((data as Req) ?? null); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [requestId, session?.user?.id]);

  const brief = parseBrief(req?.description ?? null);
  const credits = req?.estimated_credits ?? req?.requested_credits ?? 0;
  const name = req?.proposed_project_title || req?.title || "Your project";

  return (
    <div className="space-y-4">
      {/* Breadcrumb / back */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
        </button>
        <button onClick={onBuild}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs hover:border-foreground/30">
          <Plus className="w-3.5 h-3.5" /> Start another project
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading project…
        </div>
      ) : !req ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          We couldn't find that project. It may belong to another account —{" "}
          <button onClick={onBack} className="underline underline-offset-4">back to dashboard</button>.
        </div>
      ) : (
        <>
          {justCreated && (
            <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-foreground text-background grid place-items-center shrink-0">
                <Check className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">Your project is ready.</div>
                <div className="text-xs text-muted-foreground">
                  Saved to your dashboard — reopen it any time from “Your projects”.
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Project</div>
                <h2 className="mt-1 text-2xl md:text-3xl tracking-tight">{name}</h2>
                <div className="mt-1 text-xs text-muted-foreground">
                  #{req.id.slice(0, 8).toUpperCase()} · created {new Date(req.created_at).toLocaleDateString()}
                </div>
              </div>
              <span className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-wider">
                {String(req.status).replace(/_/g, " ")}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Block icon={Target} label="Project type" value={req.title.replace(/ — new project$/, "")} />
              <Block icon={Calendar} label="Timeline" value={brief.timeline || "To be confirmed"} />
              <Block icon={Wallet} label="Budget" value={brief.budget || "Flexible"} />
            </div>
          </section>

          {/* Brief */}
          <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Brief</div>
            <Field label="Description" value={brief.summary || "—"} />
            <Field label="Goals" value={brief.goals || "—"} />
            {brief.notes && <Field label="Notes" value={brief.notes} />}
          </section>

          {/* Estimate */}
          <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Estimate</div>
            <div className="mt-1 text-4xl tabular-nums font-medium">
              {credits.toLocaleString()} <span className="text-lg text-muted-foreground font-normal">credits</span>
            </div>
            <div className="text-lg text-muted-foreground tabular-nums mt-0.5">
              ${(credits * CAD_PER_CREDIT).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The team reviews this estimate before any spend. You'll hear back within 24 hours.
            </p>
          </section>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to dashboard
            </Button>
            <Button onClick={onBuild}>Start another project</Button>
          </div>
        </>
      )}
    </div>
  );
}

function Block({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1.5 text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{value}</p>
    </div>
  );
}
