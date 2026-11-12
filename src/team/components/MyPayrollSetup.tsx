import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVINCES } from "../lib/payroll";
import { toCents } from "../lib/format";

const dollars = (c?: number | null) => (c ? String(c / 100) : "");

/** Each team member fills in their own payroll setup, with plain instructions. */
export default function MyPayrollSetup({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: prof, isLoading } = useQuery({
    queryKey: ["my_payroll_profile", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("payroll_profiles").select("*").eq("user_id", userId).maybeSingle()).data,
  });
  const done = !!prof;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ worker: "", province: "ON", fed: "", prov: "", extra: "", sin: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prof) setF({ worker: prof.worker_type, province: prof.province, fed: dollars(prof.td1_federal_cents), prov: dollars(prof.td1_provincial_cents), extra: dollars(prof.extra_tax_cents), sin: prof.sin_last4 ?? "" });
  }, [prof]);

  if (isLoading) return null;
  const save = async () => {
    if (!f.worker) return toast({ title: "Pick employee or contractor first", variant: "destructive" });
    setSaving(true);
    const { error } = await (supabase as any).rpc("payroll_save_my_setup", {
      p_worker_type: f.worker, p_province: f.province,
      p_td1_federal_cents: toCents(f.fed || "0"), p_td1_provincial_cents: toCents(f.prov || "0"),
      p_extra_tax_cents: toCents(f.extra || "0"), p_sin_last4: f.sin.trim() || null,
    });
    setSaving(false);
    if (error) return toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    toast({ title: "Payroll setup saved" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["my_payroll_profile", userId] });
  };

  if (done && !open) return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
      <span className="flex items-center gap-2"><CheckCircle2 size={16} className="text-primary" /> Payroll setup done · {prof.worker_type === "employee" ? "Employee" : "Contractor"}, {prof.province}</span>
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(true)}>Edit</Button>
    </div>
  );

  const opt = (v: string, title: string, desc: string) => (
    <button type="button" aria-pressed={f.worker === v} onClick={() => setF({ ...f, worker: v })}
      className={cn("rounded-lg border p-3 text-left text-xs transition-colors", f.worker === v ? "border-foreground bg-secondary text-secondary-foreground" : "border-border bg-background text-foreground hover:bg-muted")}>
      <div className="text-sm font-semibold">{title}</div><div className="mt-0.5 text-muted-foreground">{desc}</div>
    </button>
  );

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <ClipboardList size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">Set up your payroll (2 minutes)</h3>
          <p className="text-xs text-muted-foreground">Pay stubs can't be made until everyone paid in a period has done this. Only you and admins can see it.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">1. How are you paid?</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {opt("employee", "Employee", "Rhozeland takes off CPP, EI and income tax each pay.")}
          {opt("contractor", "Contractor", "You get paid in full and handle your own taxes. Pick this if you invoice or aren't on staff.")}
        </div>
        <p className="text-[11px] text-muted-foreground">Not sure? Ask an admin — they can change it later.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">2. Province you live in</Label>
        <select value={f.province} onChange={(e) => setF({ ...f, province: e.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground sm:w-60">
          {PROVINCES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </div>

      {f.worker === "employee" && (
        <div className="space-y-2">
          <Label className="text-xs">3. Your TD1 forms</Label>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Fill in the federal TD1 and your province's TD1 (for Ontario, TD1ON) on canada.ca — search "TD1 2026".</li>
            <li>Copy the <strong>Total claim amount</strong> from the bottom of each form below.</li>
            <li>Only one job, no special credits? Leave both blank — you'll get the basic personal amount.</li>
            <li>Got another job already claiming it? Enter 0 on the form and put 1 here; tax will be taken without the credit.</li>
          </ol>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1"><Label className="text-[11px]">Federal total claim ($)</Label><Input inputMode="decimal" placeholder="Basic amount" value={f.fed} onChange={(e) => setF({ ...f, fed: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-[11px]">Provincial total claim ($)</Label><Input inputMode="decimal" placeholder="Basic amount" value={f.prov} onChange={(e) => setF({ ...f, prov: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-[11px]">Extra tax per pay ($, optional)</Label><Input inputMode="decimal" placeholder="0" value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} /></div>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">{f.worker === "employee" ? "4" : "3"}. Last 4 digits of your SIN (optional)</Label>
        <Input className="sm:w-32" inputMode="numeric" maxLength={4} placeholder="1234" value={f.sin} onChange={(e) => setF({ ...f, sin: e.target.value.replace(/\D/g, "") })} />
        <p className="text-[11px] text-muted-foreground">Shown on your T4 matching. Never enter your full SIN here.</p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving || !f.worker}>{saving && <Loader2 size={14} className="mr-1 animate-spin" />}Save setup</Button>
        {done && <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}
      </div>
    </div>
  );
}
