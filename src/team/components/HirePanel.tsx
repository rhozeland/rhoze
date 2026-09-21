import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Copy, Check } from "lucide-react";
import { DEFAULT_PROFILE, PROVINCES, PAY_FREQUENCIES } from "../lib/payroll";
import { toCents } from "../lib/format";
import { DEPT_LABELS, type Dept } from "../lib/access";

type Role = "admin" | "employee" | "client";

const EMPTY = {
  email: "",
  display_name: "",
  role: "employee" as Role,
  department: "operations" as Dept,
  job_title: "",
  started_at: new Date().toISOString().slice(0, 10),
  payment_email: "",
  phone: "",
  worker_type: DEFAULT_PROFILE.worker_type,
  province: DEFAULT_PROFILE.province,
  pay_frequency: DEFAULT_PROFILE.pay_frequency,
  hourly_rate: "",
  td1_federal: "0",
  td1_provincial: "0",
  vacation_pay_pct: "4",
  cpp_exempt: false,
  ei_exempt: false,
  notes: "",
};

/**
 * One-screen hiring flow: invite the person, set their role/department/title,
 * write their payroll profile and enrol them in benefits — all in a single save.
 */
export default function HirePanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [benefitIds, setBenefitIds] = useState<string[]>([]);
  const [tempPw, setTempPw] = useState<{ email: string; pw: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));

  const { data: plans } = useQuery({
    queryKey: ["benefit_plans_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benefit_plans")
        .select("id, name, category, is_active, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const hire = useMutation({
    mutationFn: async () => {
      const email = form.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address");

      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: {
          email,
          role: form.role,
          display_name: form.display_name.trim() || undefined,
          note: form.notes.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const userId = (data as any)?.user_id as string | undefined;
      if (!userId) throw new Error("Could not create the account");

      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          display_name: form.display_name.trim() || null,
          job_title: form.job_title.trim() || null,
          department: form.department,
          employment_status: "active",
          started_at: form.started_at || null,
          payment_email: form.payment_email.trim() || email,
          phone: form.phone.trim() || null,
          hourly_rate_cents: form.hourly_rate ? toCents(form.hourly_rate) : 0,
          internal_notes: form.notes.trim() || null,
          email,
        })
        .eq("id", userId);
      if (pErr) throw pErr;

      const { error: payErr } = await supabase.from("payroll_profiles").upsert(
        {
          user_id: userId,
          worker_type: form.worker_type,
          province: form.province,
          pay_frequency: Number(form.pay_frequency) || 26,
          td1_federal_cents: toCents(form.td1_federal || "0"),
          td1_provincial_cents: toCents(form.td1_provincial || "0"),
          cpp_exempt: form.cpp_exempt,
          ei_exempt: form.ei_exempt,
          vacation_pay_pct: Number(form.vacation_pay_pct) || 0,
          notes: form.notes.trim() || null,
        },
        { onConflict: "user_id" },
      );
      if (payErr) throw payErr;

      if (benefitIds.length) {
        const { error: bErr } = await supabase.from("employee_benefits").upsert(
          benefitIds.map((plan_id) => ({
            user_id: userId,
            plan_id,
            status: "enrolled",
            enrolled_on: form.started_at || new Date().toISOString().slice(0, 10),
          })),
          { onConflict: "user_id,plan_id" },
        );
        if (bErr) throw bErr;
      }

      return { email, temp_password: (data as any)?.temp_password as string | undefined };
    },
    onSuccess: (res) => {
      toast({ title: "Team member added", description: `${res.email} now has an account, pay details and benefits.` });
      if (res.temp_password) setTempPw({ email: res.email, pw: res.temp_password });
      setForm({ ...EMPTY });
      setBenefitIds([]);
      ["all-roles", "all-profiles", "team-invites", "payroll_setup_people", "benefit_enrolments"].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    },
    onError: (e: any) => toast({ title: "Could not add them", description: e.message, variant: "destructive" }),
  });

  const isEmployee = form.worker_type === "employee";

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); hire.mutate(); }}
        className="rounded-lg border border-border bg-card divide-y divide-border"
      >
        <Section title="Who they are">
          <Field label="Work email" required>
            <Input type="email" required className="h-9 text-xs" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@rhozeland.com" />
          </Field>
          <Field label="Full name">
            <Input className="h-9 text-xs" value={form.display_name} onChange={(e) => set({ display_name: e.target.value })} placeholder="Jane Doe" />
          </Field>
          <Field label="Job title">
            <Input className="h-9 text-xs" value={form.job_title} onChange={(e) => set({ job_title: e.target.value })} placeholder="Motion designer" />
          </Field>
          <Field label="Phone">
            <Input className="h-9 text-xs" value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="Optional" />
          </Field>
        </Section>

        <Section title="Access">
          <Field label="Portal role">
            <Select value={form.role} onValueChange={(v) => set({ role: v as Role })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee — team portal</SelectItem>
                <SelectItem value="admin">Admin — full access</SelectItem>
                <SelectItem value="client">Client — client portal only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Department">
            <Select value={form.department} onValueChange={(v) => set({ department: v as Dept })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DEPT_LABELS) as Dept[]).map((d) => (
                  <SelectItem key={d} value={d}>{DEPT_LABELS[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" className="h-9 text-xs" value={form.started_at} onChange={(e) => set({ started_at: e.target.value })} />
          </Field>
          <Field label="Payment email" hint="Where e-transfers go">
            <Input className="h-9 text-xs" value={form.payment_email} onChange={(e) => set({ payment_email: e.target.value })} placeholder="Defaults to work email" />
          </Field>
        </Section>

        <Section title="Pay details">
          <Field label="Status">
            <Select value={form.worker_type} onValueChange={(v) => set({ worker_type: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee (deductions)</SelectItem>
                <SelectItem value="contractor">Contractor (gross)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Province">
            <Select value={form.province} onValueChange={(v) => set({ province: v })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVINCES.map((p: any) => <SelectItem key={p.code} value={p.code}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pay frequency">
            <Select value={String(form.pay_frequency)} onValueChange={(v) => set({ pay_frequency: Number(v) })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAY_FREQUENCIES.map((f: any) => <SelectItem key={f.value} value={String(f.value)}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hourly rate ($)">
            <Input className="h-9 text-xs" inputMode="decimal" value={form.hourly_rate} onChange={(e) => set({ hourly_rate: e.target.value })} placeholder="0.00" />
          </Field>
          {isEmployee && (
            <>
              <Field label="TD1 federal claim ($)" hint="0 = basic personal amount">
                <Input className="h-9 text-xs" inputMode="decimal" value={form.td1_federal} onChange={(e) => set({ td1_federal: e.target.value })} />
              </Field>
              <Field label="TD1 provincial claim ($)" hint="0 = basic personal amount">
                <Input className="h-9 text-xs" inputMode="decimal" value={form.td1_provincial} onChange={(e) => set({ td1_provincial: e.target.value })} />
              </Field>
              <Field label="Vacation pay %">
                <Input className="h-9 text-xs" inputMode="decimal" value={form.vacation_pay_pct} onChange={(e) => set({ vacation_pay_pct: e.target.value })} />
              </Field>
              <div className="space-y-2 pt-5 text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.cpp_exempt} onChange={(e) => set({ cpp_exempt: e.target.checked })} /> CPP exempt
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.ei_exempt} onChange={(e) => set({ ei_exempt: e.target.checked })} /> EI exempt
                </label>
              </div>
            </>
          )}
        </Section>

        <div className="p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Benefits</div>
          <div className="flex flex-wrap gap-2">
            {(plans ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">No benefit plans yet — add them in the Benefits tab.</span>
            )}
            {(plans ?? []).map((p: any) => {
              const on = benefitIds.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setBenefitIds((ids) => (on ? ids.filter((i) => i !== p.id) : [...ids, p.id]))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent/30"}`}
                >
                  {on && <Check size={12} className="inline mr-1 -mt-0.5" />}{p.name}
                </button>
              );
            })}
          </div>
          <Textarea
            className="text-xs"
            rows={2}
            placeholder="Internal notes (offer terms, probation, anything payroll should know)"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={hire.isPending}>
              {hire.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Add team member
            </Button>
          </div>
        </div>
      </form>

      {tempPw && (
        <div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-4 text-sm">
          <div className="font-medium mb-1">Temporary password for {tempPw.email}</div>
          <p className="text-xs text-muted-foreground mb-2">Share it securely — they should change it after signing in.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background px-2 py-1 rounded border border-border font-mono text-xs">{tempPw.pw}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tempPw.pw); setCopied(true); toast({ title: "Copied" }); }}>
              {copied ? <Check size={14} /> : <Copy size={14} />} Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setTempPw(null); setCopied(false); }}>Dismiss</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}{required && <span className="text-destructive"> *</span>}
      </div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
