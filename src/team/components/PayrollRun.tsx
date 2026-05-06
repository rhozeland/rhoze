import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Check, DollarSign, Loader2, RefreshCw, Wallet } from "lucide-react";
import { formatCents, formatDate } from "../lib/format";
import { cn } from "@/lib/utils";

const SPECIALIST_RATE_CENTS = 3000;

/**
 * Admin payroll runner. For the chosen pay period:
 *  1. Aggregates *approved* timesheet rows into hourly / flat / expense totals per user.
 *  2. Aggregates revenue share from project_payments with paid_date inside the window
 *     × each project_allocations.share_pct.
 *  3. Lets admin generate a pay_stubs row per user, then mark each stub as paid manually.
 */
export default function PayrollRun({ period }: { period: any }) {
  const qc = useQueryClient();
  const periodId: string = period.id;

  // Approved timesheets in this period
  const { data: timesheets } = useQuery({
    queryKey: ["payroll_run_timesheets", periodId],
    queryFn: async () => {
      const { data: sheets } = await supabase
        .from("timesheets")
        .select("id, user_id, status, approved_at")
        .eq("period_id", periodId)
        .eq("status", "approved");
      const ids = (sheets ?? []).map((s: any) => s.id);
      const { data: entries } = ids.length
        ? await supabase.from("timesheet_entries").select("*").in("timesheet_id", ids)
        : { data: [] as any[] };
      return { sheets: sheets ?? [], entries: entries ?? [] };
    },
  });

  // Project payments collected inside the window → drives revenue share
  const { data: collectedByProject } = useQuery({
    queryKey: ["payroll_run_payments", periodId, period.start_date, period.end_date],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_payments")
        .select("project_id, amount_cents, paid_date")
        .gte("paid_date", period.start_date)
        .lte("paid_date", period.end_date);
      const by: Record<string, number> = {};
      (data ?? []).forEach((p: any) => {
        if (!p.paid_date) return;
        by[p.project_id] = (by[p.project_id] ?? 0) + (p.amount_cents ?? 0);
      });
      return by;
    },
  });

  // All allocations across all projects (we only need the ones with revenue this period)
  const projectIdsWithRevenue = Object.keys(collectedByProject ?? {});
  const { data: allocations } = useQuery({
    queryKey: ["payroll_run_allocations", projectIdsWithRevenue.join(",")],
    enabled: projectIdsWithRevenue.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("project_allocations")
        .select("project_id, user_id, share_pct, role_label")
        .in("project_id", projectIdsWithRevenue);
      return data ?? [];
    },
  });

  // Existing pay stubs for this period
  const { data: stubs } = useQuery({
    queryKey: ["pay_stubs_for_period", periodId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pay_stubs")
        .select("*")
        .eq("timesheet_period_id", periodId);
      return data ?? [];
    },
  });

  // Project name lookup for the breakdown
  const { data: projectMap } = useQuery({
    queryKey: ["payroll_project_names", projectIdsWithRevenue.join(",")],
    enabled: projectIdsWithRevenue.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, client_name")
        .in("id", projectIdsWithRevenue);
      const m = new Map<string, any>();
      (data ?? []).forEach((p: any) => m.set(p.id, p));
      return m;
    },
  });

  // Compute per-user payroll
  const computed = useMemo(() => {
    type Row = {
      user_id: string;
      hourly_cents: number;
      flat_cents: number;
      expense_cents: number;
      revshare_cents: number;
      total_cents: number;
      specialist_hours: number;
      hourly_hours: number;
      flat_hours: number;
      breakdown: any;
    };
    const rows: Record<string, Row> = {};

    const ensure = (uid: string): Row => {
      if (!rows[uid]) {
        rows[uid] = { user_id: uid, hourly_cents: 0, flat_cents: 0, expense_cents: 0, revshare_cents: 0, total_cents: 0,
          specialist_hours: 0, hourly_hours: 0, flat_hours: 0,
          breakdown: { hourly_lines: [], flat_lines: [], expense_lines: [], revshare_lines: [] } };
      }
      return rows[uid];
    };

    // Timesheet entries
    const sheetById = new Map<string, any>();
    (timesheets?.sheets ?? []).forEach((s: any) => sheetById.set(s.id, s));
    (timesheets?.entries ?? []).forEach((e: any) => {
      const s = sheetById.get(e.timesheet_id);
      if (!s) return;
      const r = ensure(s.user_id);
      const h = Number(e.hours) || 0;
      const exp = e.expense_cents || 0;
      if (e.work_type === "specialist") {
        const amt = Math.round(h * SPECIALIST_RATE_CENTS);
        r.hourly_cents += amt;
        r.specialist_hours += h;
        r.breakdown.hourly_lines.push({ deliverable: e.deliverable, type: "specialist", hours: h, rate_cents: SPECIALIST_RATE_CENTS, amount_cents: amt });
      } else if (e.work_type === "project") {
        const amt = e.rate_amount_cents || 0;
        r.flat_cents += amt;
        r.flat_hours += h;
        r.breakdown.flat_lines.push({ deliverable: e.deliverable, amount_cents: amt });
      } else if (e.work_type === "reimbursement") {
        // expense-only; handled below
      } else {
        // standard hourly
        const amt = Math.round(h * (e.rate_amount_cents || 0));
        r.hourly_cents += amt;
        r.hourly_hours += h;
        r.breakdown.hourly_lines.push({ deliverable: e.deliverable, type: "hourly", hours: h, rate_cents: e.rate_amount_cents, amount_cents: amt });
      }
      if (exp > 0) {
        r.expense_cents += exp;
        r.breakdown.expense_lines.push({ deliverable: e.deliverable, amount_cents: exp });
      }
    });

    // Revenue share from project_payments × allocations
    (allocations ?? []).forEach((a: any) => {
      const collected = (collectedByProject ?? {})[a.project_id] ?? 0;
      if (collected <= 0) return;
      const amt = Math.round((collected * Number(a.share_pct || 0)) / 100);
      if (amt === 0) return;
      const r = ensure(a.user_id);
      r.revshare_cents += amt;
      const proj = projectMap?.get(a.project_id);
      r.breakdown.revshare_lines.push({
        project_id: a.project_id,
        project_title: proj?.title || "Project",
        share_pct: Number(a.share_pct),
        collected_cents: collected,
        amount_cents: amt,
        role_label: a.role_label,
      });
    });

    Object.values(rows).forEach((r) => {
      r.total_cents = r.hourly_cents + r.flat_cents + r.revshare_cents + r.expense_cents;
    });
    return Object.values(rows).sort((a, b) => b.total_cents - a.total_cents);
  }, [timesheets, allocations, collectedByProject, projectMap]);

  // Profiles for display
  const userIds = computed.map((r) => r.user_id);
  const { data: profiles } = useQuery({
    queryKey: ["payroll_profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, alias, email, payment_method")
        .in("id", userIds);
      const m = new Map<string, any>();
      (data ?? []).forEach((p: any) => m.set(p.id, p));
      return m;
    },
  });

  const stubByUser = new Map<string, any>();
  (stubs ?? []).forEach((s: any) => stubByUser.set(s.user_id, s));

  const generateStubs = useMutation({
    mutationFn: async () => {
      // Upsert: delete existing stubs for this period that aren't paid yet, recreate
      const userIdsToReplace = computed.map((r) => r.user_id);
      if (userIdsToReplace.length === 0) return;
      await supabase
        .from("pay_stubs")
        .delete()
        .eq("timesheet_period_id", periodId)
        .is("paid_at", null)
        .in("user_id", userIdsToReplace);
      const inserts = computed.map((r) => ({
        user_id: r.user_id,
        timesheet_period_id: periodId,
        hourly_cents: r.hourly_cents,
        flat_cents: r.flat_cents,
        revshare_cents: r.revshare_cents,
        expense_cents: r.expense_cents,
        gross_amount: (r.total_cents - r.expense_cents) / 100,
        net_amount: r.total_cents / 100,
        breakdown: r.breakdown,
      }));
      // Filter out users who already have a paid stub
      const filtered = inserts.filter((i) => {
        const existing = stubByUser.get(i.user_id);
        return !existing || !existing.paid_at;
      });
      if (filtered.length === 0) return;
      const { error } = await supabase.from("pay_stubs").insert(filtered);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pay stubs generated" });
      qc.invalidateQueries({ queryKey: ["pay_stubs_for_period", periodId] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const grandTotal = computed.reduce((s, r) => s + r.total_cents, 0);
  const grandSpecHours = computed.reduce((s, r) => s + r.specialist_hours, 0);
  const grandHourlyHours = computed.reduce((s, r) => s + r.hourly_hours, 0);
  const grandFlatHours = computed.reduce((s, r) => s + r.flat_hours, 0);
  const grandTotalHours = grandSpecHours + grandHourlyHours + grandFlatHours;
  const fmtHrs = (n: number) => `${n.toLocaleString("en-CA", { maximumFractionDigits: 2 })}h`;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-orange-500 text-white px-5 py-4 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] opacity-80">Payroll run</div>
            <div className="text-xl md:text-2xl font-bold tracking-tight">{period.label}</div>
            <div className="text-xs opacity-80 mt-0.5">Pay date {formatDate(period.pay_date)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider opacity-80">Grand total</div>
            <div className="text-2xl font-bold tabular-nums">{formatCents(grandTotal)}</div>
            <div className="text-[11px] opacity-80 mt-0.5 tabular-nums">
              {fmtHrs(grandTotalHours)} total · {fmtHrs(grandHourlyHours)} hourly · {fmtHrs(grandSpecHours)} specialist · {fmtHrs(grandFlatHours)} flat
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-between flex-wrap gap-3 bg-muted/20">
          <div className="text-xs text-muted-foreground">
            Includes <strong>approved</strong> timesheets + revenue share from payments collected {formatDate(period.start_date)} → {formatDate(period.end_date)}.
          </div>
          <Button size="sm" onClick={() => generateStubs.mutate()} disabled={generateStubs.isPending || computed.length === 0}>
            {generateStubs.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Generate / refresh pay stubs
          </Button>
        </div>
      </div>

      {computed.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
          Nothing to pay yet. Approve timesheets or record project payments inside this window to populate the run.
        </div>
      ) : (
        <div className="space-y-3">
          {computed.map((r) => {
            const p = profiles?.get(r.user_id);
            const stub = stubByUser.get(r.user_id);
            return (
              <PayrollRow key={r.user_id} row={r} profile={p} stub={stub} periodId={periodId}
                onChanged={() => qc.invalidateQueries({ queryKey: ["pay_stubs_for_period", periodId] })} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PayrollRow({ row, profile, stub, periodId, onChanged }: any) {
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payForm, setPayForm] = useState({
    method: profile?.payment_method || "e-transfer",
    reference: "",
    paid_at: new Date().toISOString().slice(0, 10),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      if (!stub) throw new Error("Generate stubs first");
      const { error } = await supabase.from("pay_stubs").update({
        paid_at: new Date(payForm.paid_at).toISOString(),
        paid_method: payForm.method,
        paid_reference: payForm.reference || null,
      }).eq("id", stub.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Marked as paid" });
      setPaying(false);
      onChanged();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const unmarkPaid = useMutation({
    mutationFn: async () => {
      if (!stub) return;
      const { error } = await supabase.from("pay_stubs").update({
        paid_at: null, paid_method: null, paid_reference: null,
      }).eq("id", stub.id);
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
  });

  const paid = !!stub?.paid_at;
  const stale = stub && (
    stub.hourly_cents !== row.hourly_cents ||
    stub.flat_cents !== row.flat_cents ||
    stub.revshare_cents !== row.revshare_cents ||
    stub.expense_cents !== row.expense_cents
  );

  return (
    <div className={cn("border rounded-lg bg-card overflow-hidden", paid ? "border-emerald-500/40" : "border-border")}>
      <button onClick={() => setOpen((o) => !o)} className="w-full px-4 py-3 flex items-center gap-4 flex-wrap hover:bg-accent/20 text-left">
        <div className="flex-1 min-w-[180px]">
          <div className="font-medium text-sm">{profile?.alias || profile?.display_name || profile?.email || "—"}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Hourly {formatCents(row.hourly_cents)}</span>
            <span>·</span><span>Flat {formatCents(row.flat_cents)}</span>
            <span>·</span><span>Revshare {formatCents(row.revshare_cents)}</span>
            <span>·</span><span>Expenses {formatCents(row.expense_cents)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="font-bold tabular-nums">{formatCents(row.total_cents)}</div>
        </div>
        <div className="flex items-center gap-2">
          {paid ? (
            <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold uppercase tracking-wider">
              Paid {formatDate(stub.paid_at)}
            </span>
          ) : stub ? (
            <span className={cn("text-[11px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider",
              stale ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" : "bg-muted text-muted-foreground border-border")}>
              {stale ? "Stub stale" : "Stub ready"}
            </span>
          ) : (
            <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border font-semibold uppercase tracking-wider">
              No stub
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-4">
          {row.breakdown.hourly_lines.length > 0 && (
            <Detail title="Hourly">
              {row.breakdown.hourly_lines.map((l: any, i: number) => (
                <div key={i} className="flex justify-between gap-3 text-xs">
                  <span className="truncate">{l.deliverable || "—"} <span className="text-muted-foreground">({l.type}, {l.hours}h × {formatCents(l.rate_cents)})</span></span>
                  <span className="tabular-nums">{formatCents(l.amount_cents)}</span>
                </div>
              ))}
            </Detail>
          )}
          {row.breakdown.flat_lines.length > 0 && (
            <Detail title="Flat fees">
              {row.breakdown.flat_lines.map((l: any, i: number) => (
                <div key={i} className="flex justify-between gap-3 text-xs">
                  <span className="truncate">{l.deliverable || "—"}</span>
                  <span className="tabular-nums">{formatCents(l.amount_cents)}</span>
                </div>
              ))}
            </Detail>
          )}
          {row.breakdown.revshare_lines.length > 0 && (
            <Detail title="Revenue share">
              {row.breakdown.revshare_lines.map((l: any, i: number) => (
                <div key={i} className="flex justify-between gap-3 text-xs">
                  <span className="truncate">
                    {l.project_title}
                    <span className="text-muted-foreground"> — {l.share_pct}% of {formatCents(l.collected_cents)} collected{l.role_label ? ` · ${l.role_label}` : ""}</span>
                  </span>
                  <span className="tabular-nums">{formatCents(l.amount_cents)}</span>
                </div>
              ))}
            </Detail>
          )}
          {row.breakdown.expense_lines.length > 0 && (
            <Detail title="Expense reimbursements">
              {row.breakdown.expense_lines.map((l: any, i: number) => (
                <div key={i} className="flex justify-between gap-3 text-xs">
                  <span className="truncate">{l.deliverable || "—"}</span>
                  <span className="tabular-nums">{formatCents(l.amount_cents)}</span>
                </div>
              ))}
            </Detail>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border flex-wrap">
            {paid ? (
              <>
                <span className="text-xs text-muted-foreground">
                  {stub.paid_method}{stub.paid_reference ? ` · ${stub.paid_reference}` : ""}
                </span>
                <Button size="sm" variant="ghost" onClick={() => unmarkPaid.mutate()}>Undo paid</Button>
              </>
            ) : !stub ? (
              <span className="text-xs text-muted-foreground italic">Click "Generate / refresh pay stubs" above to create this stub.</span>
            ) : !paying ? (
              <Button size="sm" onClick={() => setPaying(true)}><Wallet size={14} /> Mark paid</Button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="e-transfer">E-Transfer</SelectItem>
                    <SelectItem value="ach">ACH</SelectItem>
                    <SelectItem value="wire">Wire</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" className="h-8 w-36 text-xs" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} />
                <Input placeholder="Ref / confirmation #" className="h-8 w-44 text-xs" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
                <Button size="sm" variant="ghost" onClick={() => setPaying(false)}>Cancel</Button>
                <Button size="sm" onClick={() => markPaid.mutate()} disabled={markPaid.isPending}><Check size={14} /> Confirm</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ title, children }: any) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
        <DollarSign size={10} />{title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}