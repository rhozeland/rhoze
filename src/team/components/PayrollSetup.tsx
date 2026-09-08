import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PROFILE, PROVINCES, PAY_FREQUENCIES } from "../lib/payroll";
import { toCents, formatCents } from "../lib/format";

/**
 * Admin screen: set each team member's employee/contractor status, province,
 * pay frequency and TD1 claim amounts. These drive the deduction calculator.
 */
export default function PayrollSetup() {
  const qc = useQueryClient();

  const { data: people, isLoading } = useQuery({
    queryKey: ["payroll_setup_people"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "employee"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id, display_name, alias, email, employment_status").in("id", ids);
      const { data: payroll } = await supabase.from("payroll_profiles").select("*").in("user_id", ids);
      const pmap = new Map((payroll ?? []).map((p: any) => [p.user_id, p]));
      return (profs ?? [])
        .map((p: any) => ({ ...p, payroll: pmap.get(p.id) || null }))
        .sort((a: any, b: any) => (a.display_name || a.email || "").localeCompare(b.display_name || b.email || ""));
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
        <ShieldCheck size={18} className="mt-0.5 text-muted-foreground shrink-0" />
        <div className="text-xs text-muted-foreground">
          Deductions are only withheld for people marked <strong>Employee</strong>. Contractors are paid gross and handle their own remittances.
          TD1 amounts default to the basic personal amount when left at zero.
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading team…</div>
      ) : (people ?? []).length === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">No team members found.</div>
      ) : (
        <div className="space-y-2">
          {(people ?? []).map((p: any) => (
            <PersonCard key={p.id} person={p} onSaved={() => qc.invalidateQueries({ queryKey: ["payroll_setup_people"] })} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({ person, onSaved }: any) {
  const existing = person.payroll;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    worker_type: existing?.worker_type ?? DEFAULT_PROFILE.worker_type,
    province: existing?.province ?? DEFAULT_PROFILE.province,
    pay_frequency: existing?.pay_frequency ?? DEFAULT_PROFILE.pay_frequency,
    td1_federal: ((existing?.td1_federal_cents ?? 0) / 100).toString(),
    td1_provincial: ((existing?.td1_provincial_cents ?? 0) / 100).toString(),
    cpp_exempt: existing?.cpp_exempt ?? false,
    ei_exempt: existing?.ei_exempt ?? false,
    extra_tax: ((existing?.extra_tax_cents ?? 0) / 100).toString(),
    vacation_pay_pct: (existing?.vacation_pay_pct ?? 4).toString(),
    sin_last4: existing?.sin_last4 ?? "",
  }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: person.id,
        worker_type: form.worker_type,
        province: form.province,
        pay_frequency: Number(form.pay_frequency) || 26,
        td1_federal_cents: toCents(form.td1_federal || "0"),
        td1_provincial_cents: toCents(form.td1_provincial || "0"),
        cpp_exempt: form.cpp_exempt,
        ei_exempt: form.ei_exempt,
        extra_tax_cents: toCents(form.extra_tax || "0"),
        vacation_pay_pct: Number(form.vacation_pay_pct) || 0,
        sin_last4: form.sin_last4 ? form.sin_last4.slice(-4) : null,
      };
      const { error } = await supabase.from("payroll_profiles").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Payroll settings saved" }); onSaved(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const isEmployee = form.worker_type === "employee";

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full px-4 py-3 flex items-center gap-3 flex-wrap text-left hover:bg-accent/20">
        <div className="flex-1 min-w-[160px]">
          <div className="text-sm font-medium">{person.display_name || person.alias || person.email || "—"}</div>
          <div className="text-xs text-muted-foreground">{person.email}</div>
        </div>
        <span className={cn("text-[11px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider",
          !existing ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
            : isEmployee ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
              : "bg-muted text-muted-foreground border-border")}>
          {!existing ? "Not set up" : isEmployee ? `Employee · ${form.province}` : `Contractor · ${form.province}`}
        </span>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 px-4 py-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Status">
              <Select value={form.worker_type} onValueChange={(v) => setForm({ ...form, worker_type: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee (deductions)</SelectItem>
                  <SelectItem value="contractor">Contractor (gross)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Province">
              <Select value={form.province} onValueChange={(v) => setForm({ ...form, province: v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pay frequency">
              <Select value={String(form.pay_frequency)} onValueChange={(v) => setForm({ ...form, pay_frequency: Number(v) })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAY_FREQUENCIES.map((f) => <SelectItem key={f.value} value={String(f.value)}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="SIN (last 4)">
              <Input className="h-9 text-xs" maxLength={4} value={form.sin_last4} onChange={(e) => setForm({ ...form, sin_last4: e.target.value.replace(/\D/g, "") })} placeholder="••••" />
            </Field>
          </div>

          {isEmployee && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="TD1 federal claim ($)" hint="0 = basic personal amount">
                <Input className="h-9 text-xs" inputMode="decimal" value={form.td1_federal} onChange={(e) => setForm({ ...form, td1_federal: e.target.value })} />
              </Field>
              <Field label="TD1 provincial claim ($)" hint="0 = basic personal amount">
                <Input className="h-9 text-xs" inputMode="decimal" value={form.td1_provincial} onChange={(e) => setForm({ ...form, td1_provincial: e.target.value })} />
              </Field>
              <Field label="Vacation pay %">
                <Input className="h-9 text-xs" inputMode="decimal" value={form.vacation_pay_pct} onChange={(e) => setForm({ ...form, vacation_pay_pct: e.target.value })} />
              </Field>
              <Field label="Extra tax per pay ($)">
                <Input className="h-9 text-xs" inputMode="decimal" value={form.extra_tax} onChange={(e) => setForm({ ...form, extra_tax: e.target.value })} />
              </Field>
            </div>
          )}

          {isEmployee && (
            <div className="flex items-center gap-4 flex-wrap text-xs">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.cpp_exempt} onChange={(e) => setForm({ ...form, cpp_exempt: e.target.checked })} />
                CPP exempt (under 18 / over 70 / electing out)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.ei_exempt} onChange={(e) => setForm({ ...form, ei_exempt: e.target.checked })} />
                EI exempt (e.g. controlling shareholder)
              </label>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}

export { formatCents };
