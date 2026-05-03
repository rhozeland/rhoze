import { useParams, Link, Navigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, CreditCard, DollarSign, Sparkles } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, formatDate } from "../lib/format";
import { getStripeEnvironment } from "@/lib/stripe";
import ProjectMilestones from "../components/ProjectMilestones";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { RhozePanel } from "../components/RhozePanel";

export default function ClientPortal() {
  const { id } = useParams<{ id: string }>();
  const { loading, session, user } = useAuth();
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("250");
  const [depositLabel, setDepositLabel] = useState<string | null>(null);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [creditPack, setCreditPack] = useState<number>(4);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["portal_project", id],
    enabled: !!id && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,client_name,status,credit_balance,dollar_balance_cents,active_tier_slug,pending_tier_slug,pending_change_at,archived_at,stripe_subscription_id,created_at,intake_estimate_cents")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["portal_payments", id],
    enabled: !!id && !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_payments")
        .select("id,label,amount_cents,paid_date,due_date,method,kind")
        .eq("project_id", id!)
        .order("paid_date", { ascending: false, nullsFirst: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: lineItems } = useQuery({
    queryKey: ["portal_line_items", id],
    enabled: !!id && !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_line_items")
        .select("grand_total_cents,debit_kind")
        .eq("project_id", id!);
      return data ?? [];
    },
  });

  const { data: milestones } = useQuery({
    queryKey: ["portal_milestones_summary", id],
    enabled: !!id && !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_milestones")
        .select("status")
        .eq("project_id", id!);
      return data ?? [];
    },
  });

  const { data: subscription } = useQuery({
    queryKey: ["portal_subscription", id, getStripeEnvironment()],
    enabled: !!id && !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status,cancel_at_period_end,current_period_end,current_period_start,price_id")
        .eq("project_id", id!)
        .eq("environment", getStripeEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const openPortal = async () => {
    const t = toast({ title: "Opening billing portal…" });
    const { data, error } = await supabase.functions.invoke("create-portal-session", {
      body: { environment: getStripeEnvironment(), returnUrl: window.location.href },
    });
    t.dismiss();
    if (error || !data?.url) {
      toast({
        title: "Could not open billing portal",
        description: error?.message || data?.error || "No active subscription found for your account.",
        variant: "destructive",
      });
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading project…</div>;

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-2xl mx-auto p-8 space-y-4">
          <h1 className="text-2xl font-semibold">Project unavailable</h1>
          <p className="text-sm text-muted-foreground">
            We couldn't find this project, or your account doesn't have access. If you have a project code,
            redeem it from your account to gain access.
          </p>
          <Link to="/" className="text-sm underline">Back home</Link>
        </div>
      </div>
    );
  }

  const tier = project.active_tier_slug;
  const pending = project.pending_tier_slug;

  // Estimate vs current
  const intakeEstimate = (project as any).intake_estimate_cents ?? 0;
  const currentTotalCents = (lineItems ?? [])
    .filter((i: any) => i.debit_kind === "dollar")
    .reduce((s: number, i: any) => s + (i.grand_total_cents ?? 0), 0);
  const deltaCents = currentTotalCents - intakeEstimate;

  // Pipeline status derived from milestones + project state
  const pipelineStage = derivePipelineStage({
    projectStatus: project.status,
    archived: !!project.archived_at,
    milestones: milestones ?? [],
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Project</div>
            <h1 className="text-2xl md:text-3xl font-semibold mt-1">{project.title}</h1>
            <div className="text-xs text-muted-foreground mt-1">
              For {project.client_name} · Status:{" "}
              <span className="font-medium text-foreground">{project.status}</span>
              {project.archived_at && <> · archived {formatDate(project.archived_at)}</>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Link to="/client/home" className="text-xs underline text-muted-foreground">
              All projects
            </Link>
          </div>
        </header>

        {/* Pipeline pills */}
        <PipelineStrip current={pipelineStage} />

        {/* Hero CTA — Manage subscription */}
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Billing</div>
                <SubscriptionBadge sub={subscription} hasStripeSub={!!project.stripe_subscription_id} />
              </div>
              <div className="text-lg font-semibold">
                {tier ? `${tier.charAt(0).toUpperCase()}${tier.slice(1)} retainer` : "No active retainer"}
              </div>
              <div className="text-xs text-muted-foreground">
                {tier
                  ? "Manage your payment method, view invoices, or cancel anytime."
                  : "If you'd like a monthly retainer, start one from the home page."}
                {pending && pending !== tier && (
                  <> · Switching to <span className="font-medium text-foreground">{pending}</span>{project.pending_change_at && <> on {formatDate(project.pending_change_at)}</>}.</>
                )}
                {subscription?.current_period_end && (
                  <>
                    {" "}·{" "}
                    {subscription.cancel_at_period_end || subscription.status === "canceled"
                      ? <>Access ends {formatDate(subscription.current_period_end)}</>
                      : <>Renews {formatDate(subscription.current_period_end)}</>}
                  </>
                )}
                {subscription?.status === "past_due" && (
                  <> · <span className="text-amber-600 dark:text-amber-400 font-medium">Payment failed — please update your card.</span></>
                )}
              </div>
            </div>
            <Button
              size="lg"
              onClick={openPortal}
              className="shrink-0"
              disabled={!project.stripe_subscription_id}
            >
              <CreditCard size={16} className="mr-2" />
              Manage subscription
              <ExternalLink size={14} className="ml-2 opacity-70" />
            </Button>
          </div>
          {!project.stripe_subscription_id && (
            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              No subscription is on file for this project yet. Once you start a retainer, the
              billing portal opens here.
            </p>
          )}
        </section>

        {/* Balances */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Session credits</div>
            <div className="text-2xl font-semibold mt-1">{project.credit_balance ?? 0}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Dollar balance</div>
            <div className="text-2xl font-semibold mt-1">{formatCents(project.dollar_balance_cents ?? 0)}</div>
            {(intakeEstimate > 0 || currentTotalCents > 0) && (
              <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                <span>
                  Est. <span className="text-foreground/80 tabular-nums">{formatCents(intakeEstimate)}</span>
                  <span className="opacity-50"> → </span>
                  <span className="text-foreground/80 tabular-nums">{formatCents(currentTotalCents)}</span>
                </span>
                {intakeEstimate > 0 && currentTotalCents !== intakeEstimate && (
                  <span
                    className={
                      deltaCents > 0
                        ? "text-amber-600 dark:text-amber-400 tabular-nums"
                        : "text-emerald-600 dark:text-emerald-400 tabular-nums"
                    }
                    title="Change vs. your original intake estimate"
                  >
                    {deltaCents > 0 ? "+" : ""}
                    {Math.round((deltaCents / Math.max(intakeEstimate, 1)) * 100)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Roadmap — clients can request review (pending → submitted),
            only the team can mark items approved. */}
        <section className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Project roadmap</div>
          <ProjectMilestones
            projectId={id!}
            canEdit={false}
            canApprove={false}
            canSubmit={true}
            onPay={(m) => {
              setDepositAmount(String(Math.round(m.price_cents / 100)));
              setDepositLabel(m.title);
              setDepositOpen(true);
            }}
          />
        </section>

        {/* Pay a deposit */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Top up</div>
              <div className="text-base font-semibold mt-0.5">Add dollars to this project</div>
              <p className="text-xs text-muted-foreground mt-1">
                Funds your project's dollar balance — used as deliverables get billed. Settles instantly by card.
              </p>
            </div>
            <Dialog open={depositOpen} onOpenChange={(o) => { setDepositOpen(o); if (!o) setDepositLabel(null); }}>
              <DialogTrigger asChild>
                <Button size="lg"><DollarSign size={16} className="mr-1" /> Add funds</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {depositLabel ? `Pay for "${depositLabel}"` : `Add funds to ${project.title}`}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Amount (USD, min $50)</Label>
                    <Input
                      type="number"
                      min="50"
                      step="1"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Added directly to this project's dollar balance after payment.
                    </p>
                  </div>
                  {Number(depositAmount) >= 50 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <StripeEmbeddedCheckout
                        topupDollarCents={Math.floor(Number(depositAmount) * 100)}
                        customerEmail={user?.email}
                        userId={user?.id}
                        projectId={id!}
                        returnUrl={`${window.location.origin}/team.html#/portal/${id}?topup=success`}
                      />
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* Buy session credits */}
        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Session credits</div>
              <div className="text-base font-semibold mt-0.5">Buy more credits</div>
              <p className="text-xs text-muted-foreground mt-1">
                Each credit covers one studio session ($60/credit, à la carte).
                Subscribe to a retainer for better pricing.
              </p>
            </div>
            <Dialog open={creditsOpen} onOpenChange={setCreditsOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="outline"><Sparkles size={16} className="mr-1" /> Buy credits</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Buy session credits</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>How many credits?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[2, 4, 8, 12].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCreditPack(n)}
                          className={`text-sm px-3 py-2 rounded-lg border transition ${
                            creditPack === n
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:border-foreground/40"
                          }`}
                        >
                          {n} credits · ${n * 60}
                        </button>
                      ))}
                    </div>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={creditPack}
                      onChange={(e) => setCreditPack(Math.max(1, Math.min(100, parseInt(e.target.value || "1"))))}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Total <strong>${creditPack * 60}</strong> for <strong>{creditPack} credit{creditPack === 1 ? "" : "s"}</strong>.
                      Added to your balance instantly after payment.
                    </p>
                  </div>
                  {creditPack >= 1 && (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <StripeEmbeddedCheckout
                        topupCreditPack={creditPack}
                        customerEmail={user?.email}
                        userId={user?.id}
                        projectId={id!}
                        returnUrl={`${window.location.origin}/team.html#/portal/${id}?topup=success`}
                      />
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </section>

        {/* Recent payments */}
        <section className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Recent payments</div>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {(payments ?? []).length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No payments yet.</div>
            )}
            {(payments ?? []).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.paid_date ? `Paid ${formatDate(p.paid_date)}` : p.due_date ? `Due ${formatDate(p.due_date)}` : "—"}
                    {p.method && <> · {p.method}</>}
                  </div>
                </div>
                <div className="font-medium shrink-0">{formatCents(p.amount_cents)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* $RHOZE rewards — kept at the bottom; explainer + balance live up top */}
        <section id="rhoze-rewards" className="scroll-mt-20">
          <RhozePanel projectId={id!} mode="client" />
        </section>
      </div>
    </div>
  );
}

function SubscriptionBadge({ sub, hasStripeSub }: { sub: any; hasStripeSub: boolean }) {
  if (!sub) {
    return (
      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border">
        {hasStripeSub ? "no status" : "none"}
      </span>
    );
  }
  const status: string = sub.status;
  const endingSoon = sub.cancel_at_period_end || status === "canceled";
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    trialing: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    past_due: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    incomplete: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    unpaid: "bg-destructive/15 text-destructive border-destructive/30",
    canceled: "bg-muted text-muted-foreground border-border",
    paused: "bg-muted text-muted-foreground border-border",
  };
  const label =
    status === "active" && endingSoon ? "Active · ending"
    : status === "past_due" ? "Past due"
    : status.replace("_", " ");
  const cls = map[status] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  );
}
type PipelineStage = "intake" | "scoped" | "in_production" | "review" | "delivered" | "archived";

function derivePipelineStage(opts: {
  projectStatus: string;
  archived: boolean;
  milestones: { status: string }[];
}): PipelineStage {
  if (opts.archived || opts.projectStatus === "archived") return "archived";
  const total = opts.milestones.length;
  if (total === 0) return "intake";
  const approved = opts.milestones.filter((m) => m.status === "approved").length;
  const submitted = opts.milestones.filter((m) => m.status === "submitted").length;
  if (approved === total) return "delivered";
  if (submitted > 0) return "review";
  if (approved > 0) return "in_production";
  return "scoped";
}

function PipelineStrip({ current }: { current: PipelineStage }) {
  const stages: { key: PipelineStage; label: string }[] = [
    { key: "intake", label: "Intake" },
    { key: "scoped", label: "Scoped" },
    { key: "in_production", label: "In production" },
    { key: "review", label: "Review" },
    { key: "delivered", label: "Delivered" },
  ];
  const currentIdx = stages.findIndex((s) => s.key === current);
  const isArchived = current === "archived";
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {stages.map((s, i) => {
          const reached = !isArchived && i <= currentIdx;
          const isCurrent = !isArchived && i === currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span
                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${
                  isCurrent
                    ? "bg-foreground text-background border-foreground"
                    : reached
                    ? "bg-muted text-foreground border-border"
                    : "bg-transparent text-muted-foreground border-border"
                }`}
              >
                {s.label}
              </span>
              {i < stages.length - 1 && (
                <span className={`h-px w-4 sm:w-6 ${reached && i < currentIdx ? "bg-foreground" : "bg-border"}`} />
              )}
            </div>
          );
        })}
        {isArchived && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border bg-muted text-muted-foreground border-border ml-auto">
            Archived
          </span>
        )}
      </div>
    </section>
  );
}
