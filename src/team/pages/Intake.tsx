import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatCents, formatDate } from "../lib/format";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

function generateCode() {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RHZ-${seg()}-${seg()}`;
}

type StatusFilter = "all" | "pending" | "paid" | "converted" | "cancelled";
type KindFilter = "all" | "deposit" | "alacarte";

function intakeKind(r: any): "deposit" | "alacarte" {
  // Subscription/deposit-led intakes carry a package_id or subscribe_monthly flag.
  if (r.subscribe_monthly || r.package_id) return "deposit";
  // Pure cart-only intakes are à la carte.
  if (Array.isArray(r.cart) && r.cart.length > 0 && !r.package_id) return "alacarte";
  return "deposit";
}

const statusBadgeClass: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  converted: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function Intake() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const { data: requests } = useQuery({
    queryKey: ["intake_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("intake_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["service_packages_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_packages").select("id, slug, name, price_cents, kind");
      if (error) throw error;
      return data;
    },
  });
  const pkgById = useMemo(() => {
    const m = new Map<string, any>();
    (packages ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [packages]);

  const convert = useMutation({
    mutationFn: async (req: any) => {
      // Create project from intake
      const code = generateCode();
      const { data: project, error: pErr } = await supabase.from("projects").insert({
        title: `${req.contact_name} — Intake ${formatDate(req.created_at)}`,
        client_name: req.contact_name,
        client_email: req.contact_email,
        client_phone: req.contact_phone,
        package_id: req.package_id,
        dollar_balance_cents: req.deposit_cents ?? 0,
        status: "active",
        project_code: code,
        notes: req.message,
      }).select().single();
      if (pErr) throw pErr;
      // Record deposit as a paid payment
      if (req.deposit_cents > 0) {
        await supabase.from("project_payments").insert({
          project_id: project.id,
          label: "Starting deposit",
          amount_cents: req.deposit_cents,
          paid_date: new Date().toISOString().slice(0, 10),
          method: req.stripe_payment_intent_id ? "stripe" : "other",
          stripe_payment_intent_id: req.stripe_payment_intent_id,
        });
      }
      // Mark intake as converted
      await supabase.from("intake_requests").update({ status: "converted", project_id: project.id }).eq("id", req.id);
      return project;
    },
    onSuccess: (project: any) => {
      toast({ title: "Project created", description: `Code: ${project.project_code}` });
      qc.invalidateQueries({ queryKey: ["intake_requests"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("intake_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Intake cancelled" });
      qc.invalidateQueries({ queryKey: ["intake_requests"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("intake_requests")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Marked as paid" });
      qc.invalidateQueries({ queryKey: ["intake_requests"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const all = requests ?? [];
  const counts = useMemo(() => {
    const c = { all: all.length, pending: 0, paid: 0, converted: 0, cancelled: 0, deposit: 0, alacarte: 0 };
    for (const r of all) {
      if (r.status in c) (c as any)[r.status]++;
      c[intakeKind(r)]++;
    }
    return c;
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (kindFilter !== "all" && intakeKind(r) !== kindFilter) return false;
      return true;
    });
  }, [all, statusFilter, kindFilter]);

  const queueDeposits = filtered.filter((r: any) => intakeKind(r) === "deposit" && (r.status === "pending" || r.status === "paid"));
  const queueAlacarte = filtered.filter((r: any) => intakeKind(r) === "alacarte" && (r.status === "pending" || r.status === "paid"));
  const archived = filtered.filter((r: any) => r.status === "converted" || r.status === "cancelled");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Intake</h1>
        <p className="text-sm text-muted-foreground">
          New deposits and à la carte purchases from rhozeland.com. Approve to convert into a project.
        </p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SummaryTile label="Pending" value={counts.pending} tone="amber" />
        <SummaryTile label="Paid · awaiting approval" value={counts.paid} tone="emerald" />
        <SummaryTile label="New deposits" value={counts.deposit} tone="default" />
        <SummaryTile label="À la carte" value={counts.alacarte} tone="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Status</span>
        {(["all", "pending", "paid", "converted", "cancelled"] as StatusFilter[]).map((s) => (
          <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {s} {s !== "all" && <span className="opacity-60 ml-1">{(counts as any)[s]}</span>}
          </FilterPill>
        ))}
        <span className="text-xs uppercase tracking-wider text-muted-foreground ml-3 mr-1">Kind</span>
        {(["all", "deposit", "alacarte"] as KindFilter[]).map((k) => (
          <FilterPill key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
            {k === "alacarte" ? "à la carte" : k}
          </FilterPill>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
          No intake records match the current filters.
        </div>
      )}

      {(statusFilter === "all" || statusFilter === "pending" || statusFilter === "paid") && queueDeposits.length > 0 && (
        <Section title="New deposits / subscriptions" subtitle="Subscription tier or deposit-led intake.">
          <div className="grid gap-2">
            {queueDeposits.map((r: any) => (
              <IntakeCard key={r.id} r={r} pkgById={pkgById} onCancel={() => cancel.mutate(r.id)} onConvert={() => convert.mutate(r)} onMarkPaid={() => markPaid.mutate(r.id)} onOpenProject={(pid) => navigate(`/projects/${pid}`)} converting={convert.isPending} />
            ))}
          </div>
        </Section>
      )}

      {(statusFilter === "all" || statusFilter === "pending" || statusFilter === "paid") && queueAlacarte.length > 0 && (
        <Section title="À la carte intake" subtitle="One-off cart purchases — no subscription attached.">
          <div className="grid gap-2">
            {queueAlacarte.map((r: any) => (
              <IntakeCard key={r.id} r={r} pkgById={pkgById} onCancel={() => cancel.mutate(r.id)} onConvert={() => convert.mutate(r)} onMarkPaid={() => markPaid.mutate(r.id)} onOpenProject={(pid) => navigate(`/projects/${pid}`)} converting={convert.isPending} />
            ))}
          </div>
        </Section>
      )}

      {archived.length > 0 && (
        <Section title="Processed" subtitle="Converted to projects or cancelled.">
          <div className="grid gap-2">
            {archived.map((r: any) => (
              <IntakeCard key={r.id} r={r} pkgById={pkgById} onCancel={() => cancel.mutate(r.id)} onConvert={() => convert.mutate(r)} onMarkPaid={() => markPaid.mutate(r.id)} onOpenProject={(pid) => navigate(`/projects/${pid}`)} converting={convert.isPending} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: "amber" | "emerald" | "default" }) {
  const toneClass =
    tone === "amber" ? "text-amber-600 dark:text-amber-400" :
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground";
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
        active ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function IntakeCard({
  r, pkgById, onCancel, onConvert, onMarkPaid, onOpenProject, converting,
}: {
  r: any;
  pkgById: Map<string, any>;
  onCancel: () => void;
  onConvert: () => void;
  onMarkPaid: () => void;
  onOpenProject: (id: string) => void;
  converting: boolean;
}) {
  const pkg = r.package_id ? pkgById.get(r.package_id) : null;
  const cart: any[] = Array.isArray(r.cart) ? r.cart : [];
  const cartTotal = cart.reduce((sum, item: any) => sum + (Number(item.price_cents) || 0) * (Number(item.qty ?? item.quantity ?? 1) || 1), 0);
  const isActionable = r.status === "pending" || r.status === "paid";
  const badgeClass = statusBadgeClass[r.status] ?? statusBadgeClass.cancelled;

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium">{r.contact_name}</div>
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeClass}`}>{r.status}</span>
            {r.subscribe_monthly && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">monthly</span>
            )}
            {r.contract_accepted && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">✓ contract</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {r.contact_email} · {r.contact_phone || "no phone"}
          </div>

          {pkg && (
            <div className="text-xs mt-2">
              <span className="text-muted-foreground">Tier: </span>
              <span className="font-medium">{pkg.name}</span>
              <span className="text-muted-foreground"> ({formatCents(pkg.price_cents)})</span>
            </div>
          )}

          {cart.length > 0 && (
            <div className="mt-2 text-xs">
              <div className="text-muted-foreground mb-1">Cart ({cart.length} item{cart.length === 1 ? "" : "s"} · {formatCents(cartTotal)})</div>
              <ul className="space-y-0.5">
                {cart.slice(0, 6).map((item: any, i: number) => (
                  <li key={i} className="flex justify-between gap-3 border-l-2 border-border pl-2">
                    <span className="truncate">
                      {item.name ?? item.title ?? item.slug ?? "Item"}
                      {item.qty && item.qty > 1 ? <span className="text-muted-foreground"> ×{item.qty}</span> : null}
                    </span>
                    <span className="text-muted-foreground shrink-0">{formatCents(item.price_cents)}</span>
                  </li>
                ))}
                {cart.length > 6 && <li className="text-muted-foreground">+{cart.length - 6} more…</li>}
              </ul>
            </div>
          )}

          {r.message && (
            <div className="text-sm mt-2 whitespace-pre-wrap border-l-2 border-border pl-2 text-foreground/90">
              {r.message}
            </div>
          )}

          {(r.stripe_session_id || r.stripe_payment_intent_id) && (
            <div className="text-[10px] text-muted-foreground mt-2 font-mono break-all">
              {r.stripe_payment_intent_id ?? r.stripe_session_id}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">deposit</div>
          <div className="text-base font-semibold mt-0.5">{formatCents(r.deposit_cents)}</div>
          {r.total_cents > 0 && r.total_cents !== r.deposit_cents && (
            <div className="text-[10px] text-muted-foreground">total {formatCents(r.total_cents)}</div>
          )}
          <div className="text-[10px] text-muted-foreground mt-1">{formatDate(r.created_at)}</div>
          {r.paid_at && <div className="text-[10px] text-emerald-600 dark:text-emerald-400">paid {formatDate(r.paid_at)}</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 justify-end">
        {r.status === "converted" && r.project_id && (
          <Button size="sm" variant="outline" onClick={() => onOpenProject(r.project_id)}>Open project</Button>
        )}
        {isActionable && (
          <>
            {r.status === "pending" && (
              <Button size="sm" variant="ghost" onClick={onMarkPaid}>Mark paid</Button>
            )}
            <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button size="sm" onClick={onConvert} disabled={converting}>
              Approve & convert to project
            </Button>
          </>
        )}
      </div>
    </div>
  );
}