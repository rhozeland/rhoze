import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { FileText, Download, Loader2 } from "lucide-react";
import { formatCents, formatDate } from "../lib/format";
import { remittanceTotals, monthKey, remittanceDueDate, type RemitStub, type RemitTotals } from "../lib/remittance";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

/** Admin payroll reports: monthly CRA remittance (PD7A) and per-employee annual totals (T4 boxes). */
export default function RemittanceReport() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const { data, isLoading } = useQuery({
    queryKey: ["remittance_report", year],
    queryFn: async () => {
      const [{ data: stubs, error }, { data: periods }] = await Promise.all([
        supabase.from("pay_stubs").select("user_id, worker_type, gross_cents, cpp_cents, cpp2_cents, ei_cents, fed_tax_cents, prov_tax_cents, employer_cpp_cents, employer_ei_cents, net_cents, paid_at, created_at, timesheet_period_id"),
        supabase.from("timesheet_periods").select("id, pay_date"),
      ]);
      if (error) throw error;
      const payDate = new Map((periods ?? []).map((p: any) => [p.id, p.pay_date]));
      const rows = (stubs ?? []).map((s: any) => ({ ...s, pay_date: String(s.paid_at || payDate.get(s.timesheet_period_id) || s.created_at).slice(0, 10) }))
        .filter((s: any) => s.pay_date.startsWith(year));
      const ids = [...new Set(rows.map((r: any) => r.user_id))];
      const { data: people } = ids.length ? await supabase.from("profiles").select("id, display_name, alias, email").in("id", ids) : { data: [] };
      const names = new Map((people ?? []).map((p: any) => [p.id, p.display_name || p.alias || p.email || "Team member"]));
      return { rows: rows as (RemitStub & { net_cents: number })[], names };
    },
  });

  const months = useMemo(() => {
    const g = new Map<string, RemitStub[]>();
    for (const r of data?.rows ?? []) { const k = monthKey(r.pay_date); g.set(k, [...(g.get(k) ?? []), r]); }
    return [...g.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, v]) => ({ month: k, totals: remittanceTotals(v) }));
  }, [data]);
  const yearTotals = useMemo(() => remittanceTotals(data?.rows ?? []), [data]);
  const perEmployee = useMemo(() => {
    const g = new Map<string, any[]>();
    for (const r of data?.rows ?? []) if (r.worker_type === "employee") g.set(r.user_id, [...(g.get(r.user_id) ?? []), r]);
    return [...g.entries()].map(([id, v]) => ({
      name: data?.names.get(id) ?? "Team member",
      gross: v.reduce((t, s) => t + s.gross_cents, 0),
      cpp: v.reduce((t, s) => t + s.cpp_cents, 0), cpp2: v.reduce((t, s) => t + s.cpp2_cents, 0),
      ei: v.reduce((t, s) => t + s.ei_cents, 0), tax: v.reduce((t, s) => t + s.fed_tax_cents + s.prov_tax_cents, 0),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const downloadCsv = () => {
    const head = "Month,Due date,Employees,Gross pay,CPP employee,CPP employer,EI employee,EI employer,Income tax,Remittance due";
    const d = (c: number) => (c / 100).toFixed(2);
    const lines = months.map(({ month, totals: t }) => [monthName(month), remittanceDueDate(month), t.employees, d(t.gross_cents), d(t.cpp_employee_cents), d(t.cpp_employer_cents), d(t.ei_employee_cents), d(t.ei_employer_cents), d(t.tax_cents), d(t.remittance_cents)].join(","));
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `remittances-${year}.csv`; a.click();
  };

  const downloadPdf = (month: string, t: RemitTotals) => {
    const doc = new jsPDF({ unit: "pt", format: "letter" }); const W = doc.internal.pageSize.getWidth(); const M = 48; let y = M;
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text("Rhozeland Collaboration Inc.", M, y);
    doc.setFontSize(11); doc.text("SOURCE DEDUCTIONS REMITTANCE", W - M, y, { align: "right" }); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(110);
    doc.text(`Remuneration paid in ${monthName(month)} · Due ${formatDate(remittanceDueDate(month))}`, M, y); y += 26; doc.setTextColor(20);
    const rows: [string, number, boolean?][] = [["Gross payroll", t.gross_cents], ["CPP — employee", t.cpp_employee_cents], ["CPP — employer", t.cpp_employer_cents], ["EI — employee", t.ei_employee_cents], ["EI — employer", t.ei_employer_cents], ["Income tax (federal + provincial)", t.tax_cents], ["Total remittance due", t.remittance_cents, true]];
    for (const [l, v, b] of rows) { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(10); if (b) { doc.setDrawColor(200); doc.line(M, y - 11, W - M, y - 11); } doc.text(l, M, y); doc.text(formatCents(v), W - M, y, { align: "right" }); y += 18; }
    y += 6; doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text(`Number of employees paid: ${t.employees}`, M, y);
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(150);
    doc.text("Use these amounts on your CRA PD7A remittance voucher or My Business Account payment.", M, doc.internal.pageSize.getHeight() - 40);
    doc.save(`remittance-${month}.pdf`);
  };

  const years = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - i));
  const cell = "px-3 py-2 text-right tabular-nums";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Payroll taxes &amp; remittances</h2>
          <p className="text-xs text-muted-foreground">CPP, EI and income tax to send to the CRA each month, plus each employee's yearly totals for T4s.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
          <Button size="sm" variant="outline" onClick={downloadCsv} disabled={!months.length}><Download size={14} /> CSV</Button>
        </div>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={15} className="animate-spin" /> Loading…</div> : !months.length ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No pay stubs for {year} yet.</div>
      ) : <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Gross payroll", yearTotals.gross_cents], ["CPP (both shares)", yearTotals.cpp_employee_cents + yearTotals.cpp_employer_cents], ["EI (both shares)", yearTotals.ei_employee_cents + yearTotals.ei_employer_cents], ["Income tax", yearTotals.tax_cents]].map(([l, v]) => (
            <div key={l as string} className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{l} · {year}</div><div className="text-base font-semibold tabular-nums">{formatCents(v as number)}</div></div>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Month paid</th><th className={cell}>CPP</th><th className={cell}>EI</th><th className={cell}>Income tax</th><th className={cell}>Remit</th><th className="px-3 py-2 text-left">Due</th><th /></tr></thead>
            <tbody>{months.map(({ month, totals: t }) => (
              <tr key={month} className="border-t border-border">
                <td className="px-3 py-2 font-medium">{monthName(month)}</td>
                <td className={cell}>{formatCents(t.cpp_employee_cents + t.cpp_employer_cents)}</td>
                <td className={cell}>{formatCents(t.ei_employee_cents + t.ei_employer_cents)}</td>
                <td className={cell}>{formatCents(t.tax_cents)}</td>
                <td className={`${cell} font-semibold`}>{formatCents(t.remittance_cents)}</td>
                <td className="px-3 py-2">{formatDate(remittanceDueDate(month))}</td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => downloadPdf(month, t)}><FileText size={14} /> PDF</Button></td>
              </tr>))}</tbody>
          </table>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Employee totals for T4 · {year}</h3>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Employee</th><th className={cell}>Box 14 income</th><th className={cell}>Box 16 CPP</th><th className={cell}>Box 16A CPP2</th><th className={cell}>Box 18 EI</th><th className={cell}>Box 22 tax</th></tr></thead>
              <tbody>{perEmployee.map((e) => (
                <tr key={e.name} className="border-t border-border"><td className="px-3 py-2 font-medium">{e.name}</td><td className={cell}>{formatCents(e.gross)}</td><td className={cell}>{formatCents(e.cpp)}</td><td className={cell}>{formatCents(e.cpp2)}</td><td className={cell}>{formatCents(e.ei)}</td><td className={cell}>{formatCents(e.tax)}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  );
}
