import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, Check, DollarSign, Download, Loader2, RefreshCw, Wallet } from "lucide-react";
import { formatCents, formatDate } from "../lib/format";
import { cn } from "@/lib/utils";
import { calcPayroll, DEFAULT_PROFILE, EMPTY_YTD, type TaxConfig, type PayrollProfile, type YTD } from "../lib/payroll";
import { downloadPayStub } from "../lib/payStubPdf";

const SPECIALIST_RATE_CENTS = 3000;

/**
 * Admin payroll runner. For the chosen pay period:
 *  1. Aggregates *approved* timesheet rows into hourly / flat / expense totals per user.
 *  2. Aggregates revenue share from project_payments paid inside the window
 *     × each project_allocations.share_pct.
 *  3. Runs the CRA deduction calculator (CPP / CPP2 / EI / federal + provincial tax)
 *     using each person's payroll profile and their year-to-date totals.
 *  4. Generates pay_stubs rows, lets admin mark them paid, and exports a PDF stub.
 */
export default function PayrollRun({ period }: { period: any }) {
  const qc = useQueryClient();
  const periodId: string = period.id;
  const taxYear = new Date(period.pay_date).getFullYear();

  // Tax tables for the year of the pay date
  const { data: taxConfig, isLoading: loadingTax } = useQuery({
    queryKey: ["payroll_tax_year", taxYear],
    queryFn: async () => {
      const { data } = await supabase.from("payroll_tax_years").select("config").eq("year", taxYear).maybeSingle();
      return (data?.config ?? null) as TaxConfig | null;
    },
  });

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
      const { data } = await supabase.from("pay_stubs").select("*").eq("timesheet_period_id", periodId);
      return data ?? [];
    },
  });

  // Prior stubs this calendar year → year-to-date totals for CPP/EI ceilings
  const { data: priorStubs } = useQuery({
    queryKey: ["pay_stubs_ytd", taxYear, periodId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pay_stubs")
        .select("user_id, gross_cents, cpp_cents, cpp2_cents, ei_cents, fed_tax_cents, prov_tax_cents, net_cents, timesheet_period_id, created_at")
        .gte("created_at", `${taxYear}-01-01`)
        .lte("created_at", `${taxYear}-12-31T23:59:59`);
      return (data ?? []).filter((s: any) => s.timesheet_period_id !== periodId);
    },
  });

  const { data: projectMap } = useQuery({
    queryKey: ["payroll_project_names", projectIdsWithRevenue.join(",")],
    enabled: projectIdsWithRevenue.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, title, client_name").in("id", projectIdsWithRevenue);
      const m = new Map<string, any>();
      (data ?? []).forEach((p: any) => m.set(p.id, p));
      return m;
    },
  });

  // ---- Aggregate raw earnings per user -----------------------------------
  const rawRows = useMemo(() => {
    type Row = {
      user_id: string;
      hourly_cents: number; flat_cents: number; expense_cents: number; revshare_cents: number;
      earnings_cents: number; specialist_hours: number; hourly_hours: number; flat_hours: number; breakdown: any;
    };
    const rows: Record<string, Row> = {};
    const ensure = (uid: string): Row => {
      if (!rows[uid]) {
        rows[uid] = { user_id: uid, hourly_cents: 0, flat_cents: 0, expense_cents: 0, revshare_cents: 0,
          earnings_cents: 0, specialist_hours: 0, hourly_hours: 0, flat_hours: 0,
          breakdown: { hourly_lines: [], flat_lines: [], expense_lines: [], revshare_lines: [] } };
      }
      return rows[uid];
    };

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
        r.hourly_cents += amt; r.specialist_hours += h;
        r.breakdown.hourly_lines.push({ deliverable: e.deliverable, type: "specialist", hours: h, rate_cents: SPECIALIST_RATE_CENTS, amount_cents: amt });
      } else if (e.work_type === "project") {
        const amt = e.rate_amount_cents || 0;
        r.flat_cents += amt; r.flat_hours += h;
        r.breakdown.flat_lines.push({ deliverable: e.deliverable, amount_cents: amt });
      } else if (e.work_type === "reimbursement") {
        // expense-only
      } else {
        const amt = Math.round(h * (e.rate_amount_cents || 0));
        r.hourly_cents += amt; r.hourly_hours += h;
        r.breakdown.hourly_lines.push({ deliverable: e.deliverable, type: "hourly", hours: h, rate_cents: e.rate_amount_cents, amount_cents: amt });
      }
      if (exp > 0) {
        r.expense_cents += exp;
        r.breakdown.expense_lines.push({ deliverable: e.deliverable, amount_cents: exp });
      }
    });

    (allocations ?? []).forEach((a: any) => {
      const collected = (collectedByProject ?? {})[a.project_id] ?? 0;
      if (collected <= 0) return;
      const amt = Math.round((collected * Number(a.share_pct || 0)) / 100);
      if (amt === 0) return;
      const r = ensure(a.user_id);
      r.revshare_cents += amt;
      const proj = projectMap?.get(a.project_id);
      r.breakdown.revshare_lines.push({
        project_id: a.project_id, project_title: proj?.title || "Project",
        share_pct: Number(a.share_pct), collected_cents: collected, amount_cents: amt, role_label: a.role_label,
      });
    });

    Object.values(rows).forEach((r) => { r.earnings_cents = r.hourly_cents + r.flat_cents + r.revshare_cents; });
    return Object.values(rows);
  }, [timesheets, allocations, collectedByProject, projectMap]);

  const userIds = rawRows.map((r) => r.user_id);

  const { data: payrollProfiles } = useQuery({
    queryKey: ["payroll_profiles_for_run", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("payroll_profiles").select("*").in("user_id", userIds);
      const m = new Map<string, any>();
      (data ?? []).forEach((p: any) => m.set(p.user_id, p));
      return m;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["payroll_display_profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, alias, email, payment_method").in("id", userIds);
      const m = new Map<string, any>();
      (data ?? []).forEach((p: any) => m.set(p.id, p));
      return m;
    },
  });

  // ---- Apply deductions ---------------------------------------------------
  const computed = useMemo(() => {
    if (!taxConfig) return [];
    const ytdByUser = new Map<string, YTD & { fed_tax_cents: number; prov_tax_cents: number; net_cents: number }>();
    (priorStubs ?? []).forEach((s: any) => {
      const cur = ytdByUser.get(s.user_id) ?? { ...EMPTY_YTD, fed_tax_cents: 0, prov_tax_cents: 0, net_cents: 0 };
      cur.gross_cents += s.gross_cents ?? 0;
      cur.cpp_cents += s.cpp_cents ?? 0;
      cur.cpp2_cents += s.cpp2_cents ?? 0;
      cur.ei_cents += s.ei_cents ?? 0;
      cur.pensionable_cents += s.gross_cents ?? 0;
      cur.fed_tax_cents += s.fed_tax_cents ?? 0;
      cur.prov_tax_cents += s.prov_tax_cents ?? 0;
      cur.net_cents += s.net_cents ?? 0;
      ytdByUser.set(s.user_id, cur);
    });

    return rawRows
      .map((r) => {
        const stored = payrollProfiles?.get(r.user_id);
        const profile: PayrollProfile = {
          ...DEFAULT_PROFILE,
          ...(stored ?? {}),
          vacation_pay_pct: Number(stored?.vacation_pay_pct ?? DEFAULT_PROFILE.vacation_pay_pct),
        };
        const ytd = ytdByUser.get(r.user_id) ?? { ...EMPTY_YTD, fed_tax_cents: 0, prov_tax_cents: 0, net_cents: 0 };
        const calc = calcPayroll({ earnings_cents: r.earnings_cents, expense_cents: r.expense_cents, profile, ytd, config: taxConfig });
        const ytdAfter = {
          gross_cents: ytd.gross_cents + calc.gross_cents,
          cpp_cents: ytd.cpp_cents + calc.cpp_cents,
          cpp2_cents: ytd.cpp2_cents + calc.cpp2_cents,
          ei_cents: ytd.ei_cents + calc.ei_cents,
          fed_tax_cents: ytd.fed_tax_cents + calc.fed_tax_cents,
          prov_tax_cents: ytd.prov_tax_cents + calc.prov_tax_cents,
          net_cents: ytd.net_cents + calc.net_cents,
        };
        return { ...r, ...calc, profile, configured: !!stored, ytd: ytdAfter };
      })
      .sort((a, b) => b.net_cents - a.net_cents);
  }, [rawRows, payrollProfiles, priorStubs, taxConfig]);

  const stubByUser = new Map<string, any>();
  (stubs ?? []).forEach((s: any) => stubByUser.set(s.user_id, s));

  const generateStubs = useMutation({
    mutationFn: async () => {
      if (computed.length === 0) return;
      const ids = computed.map((r) => r.user_id);
      await supabase.from("pay_stubs").delete().eq("timesheet_period_id", periodId).is("paid_at", null).in("user_id", ids);
      const inserts = computed
        .filter((r) => { const ex = stubByUser.get(r.user_id); return !ex || !ex.paid_at; })
        .map((r) => ({
          user_id: r.user_id,
          timesheet_period_id: periodId,
          hourly_cents: r.hourly_cents,
          flat_cents: r.flat_cents,
          revshare_cents: r.revshare_cents,
          expense_cents: r.expense_cents,
          gross_cents: r.gross_cents,
          vacation_cents: r.vacation_cents,
          cpp_cents: r.cpp_cents,
          cpp2_cents: r.cpp2_cents,
          ei_cents: r.ei_cents,
          fed_tax_cents: r.fed_tax_cents,
          prov_tax_cents: r.prov_tax_cents,
          deductions_cents: r.deductions_cents,
          net_cents: r.net_cents,
          employer_cpp_cents: r.employer_cpp_cents,
          employer_ei_cents: r.employer_ei_cents,
          worker_type: r.profile.worker_type,
          province: r.profile.province,
          pay_frequency: r.profile.pay_frequency,
          ytd: r.ytd,
          gross_amount: r.gross_cents / 100,
          net_amount: r.net_cents / 100,
          breakdown: r.breakdown,
        }));
      if (inserts.length === 0) return;
      const { error } = await supabase.from("pay_stubs").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pay stubs generated" });
      qc.invalidateQueries({ queryKey: ["pay_stubs_for_period", periodId] });
      qc.invalidateQueries({ queryKey: ["pay_stubs_ytd", taxYear, periodId] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const sum = (k: keyof (typeof computed)[number]) => computed.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const grandGross = sum("gross_cents");
  const grandNet = sum("net_cents");
  const grandDed = sum("deductions_cents");
  const employerCost = grandGross + sum("employer_cpp_cents") + sum("employer_ei_cents") + sum("expense_cents");
  const unconfigured = computed.filter((r) => !r.configured);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-orange-500 text-white px-5 py-4 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] opacity-80">Payroll run · {taxYear} tables</div>
            <div className="text-xl md:text-2xl font-bold tracking-tight">{period.label}</div>
            <div className="text-xs opacity-80 mt-0.5">Pay date {formatDate(period.pay_date)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider opacity-80">Net payout</div>
            <div className="text-2xl font-bold tabular-nums">{formatCents(grandNet)}</div>
            <div className="text-[11px] opacity-80 mt-0.5 tabular-nums">
              Gross {formatCents(grandGross)} · Deductions {formatCents(grandDed)} · Employer cost {formatCents(employerCost)}
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

      {!loadingTax && !taxConfig && (
        <Notice tone="warn">No tax tables found for {taxYear}. Deductions cannot be calculated until the year's rates are added.</Notice>
      )}
      {unconfigured.length > 0 && (
        <Notice tone="warn">
          {unconfigured.length} {unconfigured.length === 1 ? "person is" : "people are"} using default payroll settings (Employee · ON · biweekly).
          Set their status and province in the <strong>Payroll setup</strong> tab so deductions are right.
        </Notice>
      )}

      {computed.length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
          {loadingTax ? "Loading tax tables…" : "Nothing to pay yet. Approve timesheets or record project payments inside this window to populate the run."}
        </div>
      ) : (
        <div className="space-y-3">
          {computed.map((r) => (
            <PayrollRow
              key={r.user_id}
              row={r}
              profile={profiles?.get(r.user_id)}
              stub={stubByUser.get(r.user_id)}
              period={period}
              onChanged={() => qc.invalidateQueries({ queryKey: ["pay_stubs_for_period", periodId] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Notice({ tone, children }: any) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-4 py-3 text-xs",
      tone === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200" : "border-border bg-muted/20 text-muted-foreground")}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function PayrollRow({ row, profile, stub, period, onChanged }: any) {
  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payForm, setPayForm] = useState({
    method: profile?.payment_method || "e-transfer",
    reference: "",
    paid_at: new Date().toISOString().slice(0, 10),
  });

  const name = profile?.display_name || profile?.alias || profile?.email || "Team member";

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
    onSuccess: () => { toast({ title: "Marked as paid" }); setPaying(false); onChanged(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const unmarkPaid = useMutation({
    mutationFn: async () => {
      if (!stub) return;
      const { error } = await supabase.from("pay_stubs").update({ paid_at: null, paid_method: null, paid_reference: null }).eq("id", stub.id);
      if (error) throw error;
    },
    onSuccess: () => onChanged(),
  });

  const paid = !!stub?.paid_at;
  const stale = stub && (stub.gross_cents !== row.gross_cents || stub.net_cents !== row.net_cents);
  const isEmployee = row.profile.worker_type === "employee";

  return (
    <div className={cn("border rounded-lg bg-card overflow-hidden", paid ? "border-emerald-500/40" : "border-border")}>
      <button onClick={() => setOpen((o) => !o)} className="w-full px-4 py-3 flex items-center gap-4 flex-wrap hover:bg-accent/20 text-left">
        <div className="flex-1 min-w-[180px]">
          <div className="font-medium text-sm flex items-center gap-2">
            {name}
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {isEmployee ? `Employee · ${row.profile.province}` : "Contractor"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>Gross {formatCents(row.gross_cents)}</span>
            <span>·</span><span>Deductions {formatCents(row.deductions_cents)}</span>
            {row.expense_cents > 0 && (<><span>·</span><span>Expenses {formatCents(row.expense_cents)}</span></>)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Net pay</div>
          <div className="font-bold tabular-nums">{formatCents(row.net_cents)}</div>
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
            <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border font-semibold uppercase tracking-wider">No stub</span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {row.breakdown.hourly_lines.length > 0 && (
                <Detail title="Hourly">
                  {row.breakdown.hourly_lines.map((l: any, i: number) => (
                    <Line key={i} left={<>{l.deliverable || "—"} <span className="text-muted-foreground">({l.type}, {l.hours}h × {formatCents(l.rate_cents)})</span></>} amount={l.amount_cents} />
                  ))}
                </Detail>
              )}
              {row.breakdown.flat_lines.length > 0 && (
                <Detail title="Flat fees">
                  {row.breakdown.flat_lines.map((l: any, i: number) => <Line key={i} left={l.deliverable || "—"} amount={l.amount_cents} />)}
                </Detail>
              )}
              {row.breakdown.revshare_lines.length > 0 && (
                <Detail title="Revenue share">
                  {row.breakdown.revshare_lines.map((l: any, i: number) => (
                    <Line key={i} amount={l.amount_cents} left={<>{l.project_title}<span className="text-muted-foreground"> — {l.share_pct}% of {formatCents(l.collected_cents)} collected{l.role_label ? ` · ${l.role_label}` : ""}</span></>} />
                  ))}
                </Detail>
              )}
              {row.breakdown.expense_lines.length > 0 && (
                <Detail title="Expense reimbursements (non-taxable)">
                  {row.breakdown.expense_lines.map((l: any, i: number) => <Line key={i} left={l.deliverable || "—"} amount={l.amount_cents} />)}
                </Detail>
              )}
            </div>

            <div className="space-y-3">
              <Detail title="Statement of earnings">
                <Line left="Earnings" amount={row.earnings_cents} />
                {row.vacation_cents > 0 && <Line left={`Vacation pay (${row.profile.vacation_pay_pct}%)`} amount={row.vacation_cents} />}
                <Line left={<strong>Gross pay</strong>} amount={row.gross_cents} bold />
                {isEmployee ? (
                  <>
                    <Line left="CPP" amount={-row.cpp_cents} />
                    {row.cpp2_cents > 0 && <Line left="CPP2" amount={-row.cpp2_cents} />}
                    <Line left="Employment Insurance" amount={-row.ei_cents} />
                    <Line left="Federal tax" amount={-row.fed_tax_cents} />
                    <Line left="Provincial tax" amount={-row.prov_tax_cents} />
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground italic py-1">Contractor — no source deductions.</div>
                )}
                {row.expense_cents > 0 && <Line left="Expense reimbursement" amount={row.expense_cents} />}
                <Line left={<strong>Net pay</strong>} amount={row.net_cents} bold />
              </Detail>
              {isEmployee && (
                <div className="text-[11px] text-muted-foreground">
                  Employer remittance: CPP {formatCents(row.employer_cpp_cents)} + EI {formatCents(row.employer_ei_cents)}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border flex-wrap">
            <Button
              size="sm" variant="outline"
              onClick={() => downloadPayStub({
                stub: (stub ?? { ...row, worker_type: row.profile.worker_type, province: row.profile.province, pay_frequency: row.profile.pay_frequency }) as any,
                person: { name, email: profile?.email },
                period,
              })}
            >
              <Download size={14} /> PDF stub
            </Button>
            {paid ? (
              <>
                <span className="text-xs text-muted-foreground">{stub.paid_method}{stub.paid_reference ? ` · ${stub.paid_reference}` : ""}</span>
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

function Line({ left, amount, bold }: { left: React.ReactNode; amount: number; bold?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 text-xs", bold && "font-semibold border-t border-border pt-1 mt-1")}>
      <span className="truncate">{left}</span>
      <span className="tabular-nums">{amount < 0 ? `(${formatCents(Math.abs(amount))})` : formatCents(amount)}</span>
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
