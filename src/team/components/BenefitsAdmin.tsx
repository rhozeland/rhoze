import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { toCents, formatCents } from "../lib/format";

const CATEGORIES = [
  { value: "health", label: "Health & dental" },
  { value: "time_off", label: "Time off" },
  { value: "stipend", label: "Stipend" },
  { value: "equity", label: "Equity / tokens" },
  { value: "other", label: "Other" },
];

/** Admin screen: manage the benefit catalogue and who is enrolled in what. */
export default function BenefitsAdmin() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["benefit_plans_all"] });
    qc.invalidateQueries({ queryKey: ["benefit_plans_active"] });
    qc.invalidateQueries({ queryKey: ["benefit_enrolments"] });
  };

  const { data: plans, isLoading } = useQuery({
    queryKey: ["benefit_plans_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("benefit_plans").select("*").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: people } = useQuery({
    queryKey: ["benefit_enrolments"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "employee"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id, display_name, alias, email").in("id", ids);
      const { data: enrol } = await supabase.from("employee_benefits").select("*").in("user_id", ids);
      return (profs ?? [])
        .map((p: any) => ({ ...p, benefits: (enrol ?? []).filter((e: any) => e.user_id === p.id) }))
        .sort((a: any, b: any) => (a.display_name || a.email || "").localeCompare(b.display_name || b.email || ""));
    },
  });

  const [draft, setDraft] = useState({ name: "", category: "other", description: "", employer_cost: "", employee_cost: "" });

  const addPlan = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Give the benefit a name");
      const { error } = await supabase.from("benefit_plans").insert({
        name: draft.name.trim(),
        category: draft.category,
        description: draft.description.trim() || null,
        employer_cost_cents: draft.employer_cost ? toCents(draft.employer_cost) : 0,
        employee_cost_cents: draft.employee_cost ? toCents(draft.employee_cost) : 0,
        sort_order: (plans?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Benefit added" }); setDraft({ name: "", category: "other", description: "", employer_cost: "", employee_cost: "" }); invalidate(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const togglePlan = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("benefit_plans").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removePlan = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("benefit_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Benefit removed" }); invalidate(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const toggleEnrol = useMutation({
    mutationFn: async ({ userId, planId, on }: { userId: string; planId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase
          .from("employee_benefits")
          .upsert({ user_id: userId, plan_id: planId, status: "enrolled", ended_on: null }, { onConflict: "user_id,plan_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_benefits").delete().eq("user_id", userId).eq("plan_id", planId);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const activePlans = useMemo(() => (plans ?? []).filter((p: any) => p.is_active), [plans]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Benefit plans</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border bg-card">
            {(plans ?? []).map((p: any) => (
              <div key={p.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}
                    {p.description ? ` · ${p.description}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Employer {formatCents(p.employer_cost_cents)} · Employee {formatCents(p.employee_cost_cents)}
                </div>
                <Button size="sm" variant={p.is_active ? "outline" : "ghost"} onClick={() => togglePlan.mutate({ id: p.id, is_active: !p.is_active })}>
                  {p.is_active ? "Active" : "Inactive"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removePlan.mutate(p.id)}><Trash2 size={14} /></Button>
              </div>
            ))}
            {(plans ?? []).length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No benefits yet.</div>}
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); addPlan.mutate(); }}
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1.4fr_0.8fr_0.8fr_auto] rounded-lg border border-border bg-card p-3"
        >
          <Input className="h-9 text-xs" placeholder="Benefit name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-9 text-xs" placeholder="Short description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          <Input className="h-9 text-xs" inputMode="decimal" placeholder="Employer $" value={draft.employer_cost} onChange={(e) => setDraft({ ...draft, employer_cost: e.target.value })} />
          <Input className="h-9 text-xs" inputMode="decimal" placeholder="Employee $" value={draft.employee_cost} onChange={(e) => setDraft({ ...draft, employee_cost: e.target.value })} />
          <Button type="submit" size="sm" disabled={addPlan.isPending}><Plus size={14} /> Add</Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Who's enrolled</h2>
        <div className="rounded-lg border border-border divide-y divide-border bg-card">
          {(people ?? []).map((p: any) => (
            <div key={p.id} className="px-4 py-3 space-y-2">
              <div className="text-sm font-medium">{p.display_name || p.alias || p.email || "—"}</div>
              <div className="flex flex-wrap gap-2">
                {activePlans.map((plan: any) => {
                  const on = p.benefits.some((b: any) => b.plan_id === plan.id && b.status === "enrolled");
                  return (
                    <button
                      key={plan.id}
                      onClick={() => toggleEnrol.mutate({ userId: p.id, planId: plan.id, on: !on })}
                      className={`text-xs px-3 py-1.5 rounded-full border transition ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-accent/30"}`}
                    >
                      {on && <Check size={12} className="inline mr-1 -mt-0.5" />}{plan.name}
                    </button>
                  );
                })}
                {activePlans.length === 0 && <span className="text-xs text-muted-foreground">Add a benefit plan first.</span>}
              </div>
            </div>
          ))}
          {(people ?? []).length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No team members yet.</div>}
        </div>
      </section>
    </div>
  );
}
