import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ExternalLink, ArrowLeft, CreditCard } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, formatDate } from "../lib/format";
import { getStripeEnvironment } from "@/lib/stripe";

export default function ClientPortal() {
  const { id } = useParams<{ id: string }>();
  const { loading, session, isTeam } = useAuth();

  const { data: project, isLoading, error } = useQuery({
    queryKey: ["portal_project", id],
    enabled: !!id && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,title,client_name,status,credit_balance,dollar_balance_cents,active_tier_slug,pending_tier_slug,pending_change_at,archived_at,stripe_subscription_id,created_at")
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland · Client portal</div>
            <h1 className="text-2xl md:text-3xl font-semibold mt-1">{project.title}</h1>
            <div className="text-xs text-muted-foreground mt-1">
              For {project.client_name} · Status:{" "}
              <span className="font-medium text-foreground">{project.status}</span>
              {project.archived_at && <> · archived {formatDate(project.archived_at)}</>}
            </div>
          </div>
          {isTeam && (
            <Link to={`/projects/${id}`} className="text-xs underline text-muted-foreground inline-flex items-center gap-1">
              <ArrowLeft size={12} /> Team view
            </Link>
          )}
        </header>

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
      </div>
    </div>
  );
}