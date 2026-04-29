import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { formatCents, formatDate } from "../lib/format";

function generateCode() {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RHZ-${seg()}-${seg()}`;
}

export default function Intake() {
  const qc = useQueryClient();

  const { data: requests } = useQuery({
    queryKey: ["intake_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("intake_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake_requests"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Intake</h1>
        <p className="text-sm text-muted-foreground">New project requests from rhozeland.com.</p>
      </div>

      <div className="grid gap-2">
        {(requests ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
            No intake requests yet.
          </div>
        )}
        {(requests ?? []).map((r: any) => (
          <div key={r.id} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{r.contact_name}</div>
                <div className="text-xs text-muted-foreground">{r.contact_email} · {r.contact_phone || "no phone"}</div>
                {r.message && <div className="text-sm mt-2 whitespace-pre-wrap">{r.message}</div>}
                {Array.isArray(r.cart) && r.cart.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {r.cart.length} item{r.cart.length === 1 ? "" : "s"} in cart
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.status}</div>
                <div className="text-sm font-medium mt-0.5">{formatCents(r.deposit_cents)}</div>
                <div className="text-[10px] text-muted-foreground">{formatDate(r.created_at)}</div>
              </div>
            </div>
            {r.status === "pending" || r.status === "paid" ? (
              <div className="flex gap-2 mt-3 justify-end">
                <Button size="sm" variant="outline" onClick={() => cancel.mutate(r.id)}>Cancel</Button>
                <Button size="sm" onClick={() => convert.mutate(r)} disabled={convert.isPending}>Convert to project</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}