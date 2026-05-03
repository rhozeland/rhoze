import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Save } from "lucide-react";
import { useAuth } from "../lib/auth";

const fmt = (n: number) => Number(n).toLocaleString();

export default function Rewards() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ["rhoze_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rhoze_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (settings && !form) setForm(settings); }, [settings, form]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("rhoze_settings")
        .update({
          earn_per_dollar: Number(form.earn_per_dollar),
          bonus_first_project: Number(form.bonus_first_project),
          reward_event_attended: Number(form.reward_event_attended),
          reward_referral: Number(form.reward_referral),
          credit_cost_rhoze: Number(form.credit_cost_rhoze),
          max_discount_pct: Number(form.max_discount_pct),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Settings saved" }); qc.invalidateQueries({ queryKey: ["rhoze_settings"] }); },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["rhoze_leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rhoze_balances")
        .select("project_id,balance,lifetime_earned,lifetime_spent,solana_wallet")
        .order("lifetime_earned", { ascending: false })
        .limit(20);
      const ids = (data ?? []).map((r: any) => r.project_id);
      if (ids.length === 0) return [];
      const { data: projects } = await supabase
        .from("projects").select("id,title,client_name").in("id", ids);
      const byId = Object.fromEntries((projects ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((r: any) => ({ ...r, project: byId[r.project_id] }));
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-fuchsia-500 dark:text-fuchsia-400" />
        <div>
          <h1 className="text-2xl font-semibold">$RHOZE Rewards</h1>
          <p className="text-sm text-muted-foreground">Loyalty token economics, balances, and airdrop queue.</p>
        </div>
      </div>

      {/* Settings */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Economics</div>
            <div className="text-xs text-muted-foreground">Tune earning, conversion, and discount rules. Applies to new payments + redemptions.</div>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => saveSettings.mutate()} disabled={!form || saveSettings.isPending}>
              <Save size={14} /> Save
            </Button>
          )}
        </div>
        {form && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="$RHOZE earned per $1 spent" value={form.earn_per_dollar} onChange={(v) => setForm({ ...form, earn_per_dollar: v })} disabled={!isAdmin} hint="Default 10. Auto-credited on every paid invoice." />
            <Field label="First-project bonus" value={form.bonus_first_project} onChange={(v) => setForm({ ...form, bonus_first_project: v })} disabled={!isAdmin} hint="One-time, on first paid payment per project." />
            <Field label="Event attended reward" value={form.reward_event_attended} onChange={(v) => setForm({ ...form, reward_event_attended: v })} disabled={!isAdmin} hint="Awarded manually from a project page or here." />
            <Field label="Referral reward" value={form.reward_referral} onChange={(v) => setForm({ ...form, reward_referral: v })} disabled={!isAdmin} hint="When a client brings in a new paying client." />
            <Field label="$RHOZE per 1 credit" value={form.credit_cost_rhoze} onChange={(v) => setForm({ ...form, credit_cost_rhoze: v })} disabled={!isAdmin} hint="Lower = clients get more discount when redeeming." />
            <Field label="Max discount %" value={form.max_discount_pct} onChange={(v) => setForm({ ...form, max_discount_pct: v })} disabled={!isAdmin} hint="Cap on how much of an invoice can be paid in $RHOZE." />
          </div>
        )}
      </section>

      {/* Leaderboard */}
      <section className="space-y-3">
        <div className="text-sm font-semibold">Top earners</div>
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {(leaderboard ?? []).length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">No balances yet. They'll show up after the first paid project.</div>
          )}
          {(leaderboard ?? []).map((r: any) => (
            <Link key={r.project_id} to={`/projects/${r.project_id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-accent/40">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.project?.title ?? "Project"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.project?.client_name ?? "—"}{r.solana_wallet ? <> · wallet linked</> : <> · no wallet</>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-medium tabular-nums">{fmt(r.balance)} <span className="text-xs text-muted-foreground">$RHOZE</span></div>
                <div className="text-[11px] text-muted-foreground tabular-nums">earned {fmt(r.lifetime_earned)} · spent {fmt(r.lifetime_spent)}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, hint, disabled }: { label: string; value: any; onChange: (v: string) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
