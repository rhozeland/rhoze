import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useAuth } from "../lib/auth";

export default function Payroll() {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", start_date: "", end_date: "", pay_date: "" });
  const [stubOpen, setStubOpen] = useState<string | null>(null);
  const [stubForm, setStubForm] = useState({ user_id: "", gross_amount: "", net_amount: "", notes: "" });

  const { data: periods } = useQuery({
    queryKey: ["pay_periods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pay_periods").select("*").order("pay_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: stubs } = useQuery({
    queryKey: ["pay_stubs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pay_stubs").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-list"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, display_name");
      if (error) throw error;
      return data;
    },
  });

  const createPeriod = useMutation({
    mutationFn: async () => {
      if (!form.label || !form.start_date || !form.end_date || !form.pay_date) throw new Error("All fields required");
      const { error } = await supabase.from("pay_periods").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pay period added" });
      setOpen(false);
      setForm({ label: "", start_date: "", end_date: "", pay_date: "" });
      qc.invalidateQueries({ queryKey: ["pay_periods"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createStub = useMutation({
    mutationFn: async (periodId: string) => {
      if (!stubForm.user_id) throw new Error("Pick an employee");
      const { error } = await supabase.from("pay_stubs").insert({
        pay_period_id: periodId,
        user_id: stubForm.user_id,
        gross_amount: Number(stubForm.gross_amount || 0),
        net_amount: Number(stubForm.net_amount || 0),
        notes: stubForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Stub added" });
      setStubOpen(null);
      setStubForm({ user_id: "", gross_amount: "", net_amount: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["pay_stubs"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="text-sm text-muted-foreground">{isAdmin ? "Manage pay periods and stubs." : "Your pay history."}</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus size={14} /> New pay period</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New pay period</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Label</Label><Input placeholder="e.g. Mar 1–15" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>End</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>Pay date</Label><Input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-3">
        {(periods ?? []).length === 0 && <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">No pay periods yet.</div>}
        {(periods ?? []).map((p: any) => {
          const periodStubs = (stubs ?? []).filter((s: any) => s.pay_period_id === p.id && (isAdmin || s.user_id === user?.id));
          return (
            <div key={p.id} className="border border-border rounded-lg bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.start_date} → {p.end_date} · paid {p.pay_date}</div>
                </div>
                {isAdmin && (
                  <Dialog open={stubOpen === p.id} onOpenChange={(o) => setStubOpen(o ? p.id : null)}>
                    <DialogTrigger asChild><Button variant="outline" size="sm"><Plus size={14} /> Add stub</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add pay stub</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label>Employee</Label>
                          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={stubForm.user_id} onChange={(e) => setStubForm({ ...stubForm, user_id: e.target.value })}>
                            <option value="">Select…</option>
                            {(profiles ?? []).map((pr: any) => <option key={pr.id} value={pr.id}>{pr.display_name ?? pr.id}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5"><Label>Gross</Label><Input type="number" value={stubForm.gross_amount} onChange={(e) => setStubForm({ ...stubForm, gross_amount: e.target.value })} /></div>
                          <div className="space-y-1.5"><Label>Net</Label><Input type="number" value={stubForm.net_amount} onChange={(e) => setStubForm({ ...stubForm, net_amount: e.target.value })} /></div>
                        </div>
                        <div className="space-y-1.5"><Label>Notes</Label><Input value={stubForm.notes} onChange={(e) => setStubForm({ ...stubForm, notes: e.target.value })} /></div>
                      </div>
                      <DialogFooter><Button onClick={() => createStub.mutate(p.id)} disabled={createStub.isPending}>Save</Button></DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              {periodStubs.length > 0 && (
                <div className="mt-3 border-t border-border pt-3 space-y-1.5">
                  {periodStubs.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{isAdmin ? s.user_id.slice(0, 8) : "You"}</span>
                      <span>Gross ${Number(s.gross_amount).toLocaleString()} · Net ${Number(s.net_amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}