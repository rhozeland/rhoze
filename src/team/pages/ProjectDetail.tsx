import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, toCents, formatDate } from "../lib/format";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [payOpen, setPayOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);

  const [payForm, setPayForm] = useState({ label: "", amount: "", due_date: "", paid_date: "", method: "e-transfer", notes: "" });
  const [itemForm, setItemForm] = useState({
    booking_date: "", location: "", deliverable: "", description: "",
    session_hours: "1", base_amount: "", debit_kind: "dollar", credits_used: "0",
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["project_payments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("project_payments").select("*").eq("project_id", id!).order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: items } = useQuery({
    queryKey: ["project_line_items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("project_line_items").select("*").eq("project_id", id!).order("booking_date", { ascending: false }).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const totalPaid = (payments ?? []).filter((p: any) => p.paid_date).reduce((s: number, p: any) => s + (p.amount_cents ?? 0), 0);
  const totalSpent = (items ?? []).filter((i: any) => i.debit_kind === "dollar").reduce((s: number, i: any) => s + (i.grand_total_cents ?? 0), 0);
  const creditsSpent = (items ?? []).filter((i: any) => i.debit_kind === "credit").reduce((s: number, i: any) => s + (i.credits_used ?? 0), 0);

  const addPayment = useMutation({
    mutationFn: async () => {
      const amount = toCents(payForm.amount);
      if (!payForm.label.trim() || !amount) throw new Error("Label and amount required");
      const { error } = await supabase.from("project_payments").insert({
        project_id: id!,
        label: payForm.label.trim(),
        amount_cents: amount,
        due_date: payForm.due_date || null,
        paid_date: payForm.paid_date || null,
        method: payForm.method,
        notes: payForm.notes.trim() || null,
      });
      if (error) throw error;
      // If marked paid, increment dollar balance
      if (payForm.paid_date) {
        await supabase.from("projects").update({
          dollar_balance_cents: (project?.dollar_balance_cents ?? 0) + amount,
        }).eq("id", id!);
      }
    },
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      setPayOpen(false);
      setPayForm({ label: "", amount: "", due_date: "", paid_date: "", method: "e-transfer", notes: "" });
      qc.invalidateQueries({ queryKey: ["project_payments", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const amount = toCents(itemForm.base_amount);
      if (!itemForm.deliverable.trim()) throw new Error("Deliverable required");
      const credits = parseInt(itemForm.credits_used || "0", 10) || 0;
      const { error } = await supabase.from("project_line_items").insert({
        project_id: id!,
        booking_date: itemForm.booking_date || null,
        location: itemForm.location.trim() || null,
        deliverable: itemForm.deliverable.trim(),
        description: itemForm.description.trim() || null,
        session_hours: parseFloat(itemForm.session_hours) || 0,
        base_amount_cents: amount,
        grand_total_cents: amount,
        debit_kind: itemForm.debit_kind,
        credits_used: itemForm.debit_kind === "credit" ? credits : 0,
        status: "completed",
      });
      if (error) throw error;
      // Update project balance
      const updates: any = {};
      if (itemForm.debit_kind === "dollar") updates.dollar_balance_cents = (project?.dollar_balance_cents ?? 0) - amount;
      else updates.credit_balance = (project?.credit_balance ?? 0) - credits;
      await supabase.from("projects").update(updates).eq("id", id!);
    },
    onSuccess: () => {
      toast({ title: "Deliverable logged" });
      setItemOpen(false);
      setItemForm({ booking_date: "", location: "", deliverable: "", description: "", session_hours: "1", base_amount: "", debit_kind: "dollar", credits_used: "0" });
      qc.invalidateQueries({ queryKey: ["project_line_items", id] });
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div>Not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/projects" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft size={12} /> All projects
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <p className="text-sm text-muted-foreground">{project.client_name} · {project.client_email || "no email"} · {project.status}</p>
        </div>
        {project.project_code && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Client code</div>
            <div className="text-sm font-mono">{project.project_code}</div>
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Dollar balance" value={formatCents(project.dollar_balance_cents)} />
        <Stat label="Credits remaining" value={`${project.credit_balance}`} />
        <Stat label="Total paid" value={formatCents(totalPaid)} />
        <Stat label="Total spent" value={`${formatCents(totalSpent)} · ${creditsSpent} cr`} />
      </div>

      <Tabs defaultValue="ledger">
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Deliverables & sessions billed against this project.</div>
            {isAdmin && (
              <Dialog open={itemOpen} onOpenChange={setItemOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Log deliverable</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Log deliverable</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Booking date</Label><Input type="date" value={itemForm.booking_date} onChange={(e) => setItemForm({ ...itemForm, booking_date: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Location</Label><Input value={itemForm.location} onChange={(e) => setItemForm({ ...itemForm, location: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Deliverable *</Label><Input value={itemForm.deliverable} onChange={(e) => setItemForm({ ...itemForm, deliverable: e.target.value })} placeholder="e.g. Mixing for 'Holy Water'" /></div>
                    <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Session hours</Label><Input type="number" step="0.25" value={itemForm.session_hours} onChange={(e) => setItemForm({ ...itemForm, session_hours: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Amount ($)</Label><Input type="number" step="0.01" value={itemForm.base_amount} onChange={(e) => setItemForm({ ...itemForm, base_amount: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>Bill from</Label>
                        <Select value={itemForm.debit_kind} onValueChange={(v) => setItemForm({ ...itemForm, debit_kind: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dollar">Dollar balance</SelectItem>
                            <SelectItem value="credit">Credits</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {itemForm.debit_kind === "credit" && (
                        <div className="space-y-1.5"><Label>Credits used</Label><Input type="number" value={itemForm.credits_used} onChange={(e) => setItemForm({ ...itemForm, credits_used: e.target.value })} /></div>
                      )}
                    </div>
                  </div>
                  <DialogFooter><Button onClick={() => addItem.mutate()} disabled={addItem.isPending}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Deliverable</th>
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-right px-3 py-2">Hrs</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-right px-3 py-2">Billed from</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(items ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No deliverables yet.</td></tr>
                )}
                {(items ?? []).map((i: any) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(i.booking_date)}</td>
                    <td className="px-3 py-2">{i.deliverable}</td>
                    <td className="px-3 py-2 text-muted-foreground">{i.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{i.session_hours ?? 0}</td>
                    <td className="px-3 py-2 text-right">{formatCents(i.grand_total_cents)}</td>
                    <td className="px-3 py-2 text-right text-xs">{i.debit_kind === "credit" ? `${i.credits_used} cr` : "$"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Retainer & deposit payments received.</div>
            {isAdmin && (
              <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Record payment</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5"><Label>Label *</Label><Input value={payForm.label} onChange={(e) => setPayForm({ ...payForm, label: e.target.value })} placeholder="e.g. 5th retainer" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Amount ($) *</Label><Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></div>
                      <div className="space-y-1.5">
                        <Label>Method</Label>
                        <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="e-transfer">Interac e-Transfer</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="stripe">Card (Stripe)</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={payForm.due_date} onChange={(e) => setPayForm({ ...payForm, due_date: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Paid date</Label><Input type="date" value={payForm.paid_date} onChange={(e) => setPayForm({ ...payForm, paid_date: e.target.value })} /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={() => addPayment.mutate()} disabled={addPayment.isPending}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Label</th>
                  <th className="text-left px-3 py-2">Due</th>
                  <th className="text-left px-3 py-2">Paid</th>
                  <th className="text-left px-3 py-2">Method</th>
                  <th className="text-right px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(payments ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No payments yet.</td></tr>
                )}
                {(payments ?? []).map((p: any) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">{p.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(p.due_date)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(p.paid_date)}</td>
                    <td className="px-3 py-2 text-xs">{p.method}</td>
                    <td className="px-3 py-2 text-right">{formatCents(p.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-3 mt-4">
          <div className="text-sm whitespace-pre-wrap text-muted-foreground border border-border rounded-lg p-4 bg-card">
            {project.notes || "No notes yet."}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}