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
import { ArrowLeft, Plus, Trash2, ArrowUpDown, ExternalLink, Pencil, Save, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, toCents, formatDate } from "../lib/format";
import { getStripeEnvironment } from "@/lib/stripe";
import ProjectMilestones from "../components/ProjectMilestones";
import ProjectAllocations from "../components/ProjectAllocations";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [payOpen, setPayOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const [tierForm, setTierForm] = useState({ newTierSlug: "gold", immediate: false, topUpCredits: false });

  // Inline edit state for ledger rows
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState<{ deliverable: string; description: string; session_hours: string; base_amount: string; debit_kind: string; credits_used: string }>({
    deliverable: "", description: "", session_hours: "0", base_amount: "0", debit_kind: "dollar", credits_used: "0",
  });

  // Notes editing
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

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

  const changeTier = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-change-tier", {
        body: {
          projectId: id!,
          newTierSlug: tierForm.newTierSlug,
          immediate: tierForm.immediate,
          topUpCredits: tierForm.topUpCredits,
          environment: getStripeEnvironment(),
        },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Failed");
    },
    onSuccess: () => {
      toast({ title: tierForm.immediate ? "Tier switched immediately" : "Tier change queued for next cycle" });
      setTierOpen(false);
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e: any) => toast({ title: "Tier change failed", description: e.message, variant: "destructive" }),
  });

  const openPortal = async () => {
    const { data, error } = await supabase.functions.invoke("create-portal-session", {
      body: { environment: getStripeEnvironment(), returnUrl: window.location.href },
    });
    if (error || !data?.url) {
      toast({ title: "Could not open portal", description: error?.message || data?.error || "No subscription on file", variant: "destructive" });
      return;
    }
    window.open(data.url, "_blank");
  };

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

  const updateItem = useMutation({
    mutationFn: async (itemId: string) => {
      const amount = toCents(editItemForm.base_amount);
      const credits = parseInt(editItemForm.credits_used || "0", 10) || 0;
      const { error } = await supabase
        .from("project_line_items")
        .update({
          deliverable: editItemForm.deliverable.trim(),
          description: editItemForm.description.trim() || null,
          session_hours: parseFloat(editItemForm.session_hours) || 0,
          base_amount_cents: amount,
          grand_total_cents: amount,
          debit_kind: editItemForm.debit_kind,
          credits_used: editItemForm.debit_kind === "credit" ? credits : 0,
        })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deliverable updated" });
      setEditingItemId(null);
      qc.invalidateQueries({ queryKey: ["project_line_items", id] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("project_line_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deliverable deleted" });
      qc.invalidateQueries({ queryKey: ["project_line_items", id] });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const saveNotes = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase.from("projects").update({ notes: next }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notes saved" });
      setNotesDraft(null);
      qc.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const startEditItem = (i: any) => {
    setEditingItemId(i.id);
    setEditItemForm({
      deliverable: i.deliverable ?? "",
      description: i.description ?? "",
      session_hours: String(i.session_hours ?? 0),
      base_amount: ((i.grand_total_cents ?? 0) / 100).toString(),
      debit_kind: i.debit_kind ?? "dollar",
      credits_used: String(i.credits_used ?? 0),
    });
  };

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
          {project.active_tier_slug && (
            <p className="text-xs text-muted-foreground mt-1">
              Active tier: <span className="font-medium text-foreground">{project.active_tier_slug}</span>
              {project.pending_tier_slug && <> · Pending → <span className="font-medium text-foreground">{project.pending_tier_slug}</span></>}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {project.project_code && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Client code</div>
              <div className="text-sm font-mono">{project.project_code}</div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openPortal}><ExternalLink size={12} /> Manage subscription</Button>
            {isAdmin && (
              <Dialog open={tierOpen} onOpenChange={setTierOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><ArrowUpDown size={12} /> Change tier</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Change subscription tier</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>New tier</Label>
                      <Select value={tierForm.newTierSlug} onValueChange={(v) => setTierForm({ ...tierForm, newTierSlug: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bronze">Bronze ($240/mo · 4 credits)</SelectItem>
                          <SelectItem value="gold">Gold ($560/mo · 10 credits)</SelectItem>
                          <SelectItem value="diamond">Diamond ($1500/mo · 25 credits)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={tierForm.immediate} onChange={(e) => setTierForm({ ...tierForm, immediate: e.target.checked })} />
                      Switch immediately (with proration)
                    </label>
                    {tierForm.immediate && (
                      <label className="flex items-center gap-2 text-sm pl-6">
                        <input type="checkbox" checked={tierForm.topUpCredits} onChange={(e) => setTierForm({ ...tierForm, topUpCredits: e.target.checked })} />
                        Top up credits for new tier now
                      </label>
                    )}
                    <p className="text-xs text-muted-foreground">Default: change applies at next billing cycle for cleanest accounting. Use immediate only for special accommodations.</p>
                  </div>
                  <DialogFooter><Button onClick={() => changeTier.mutate()} disabled={changeTier.isPending}>Apply</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
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
          <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
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
                  editingItemId === i.id ? (
                    <tr key={i.id} className="bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDate(i.booking_date)}</td>
                      <td className="px-3 py-2">
                        <Input value={editItemForm.deliverable} onChange={(e) => setEditItemForm({ ...editItemForm, deliverable: e.target.value })} className="h-8" />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={editItemForm.description} onChange={(e) => setEditItemForm({ ...editItemForm, description: e.target.value })} className="h-8" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input type="number" step="0.25" value={editItemForm.session_hours} onChange={(e) => setEditItemForm({ ...editItemForm, session_hours: e.target.value })} className="h-8 w-16 text-right ml-auto" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input type="number" step="0.01" value={editItemForm.base_amount} onChange={(e) => setEditItemForm({ ...editItemForm, base_amount: e.target.value })} className="h-8 w-24 text-right ml-auto" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Select value={editItemForm.debit_kind} onValueChange={(v) => setEditItemForm({ ...editItemForm, debit_kind: v })}>
                            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dollar">$</SelectItem>
                              <SelectItem value="credit">cr</SelectItem>
                            </SelectContent>
                          </Select>
                          {editItemForm.debit_kind === "credit" && (
                            <Input type="number" value={editItemForm.credits_used} onChange={(e) => setEditItemForm({ ...editItemForm, credits_used: e.target.value })} className="h-8 w-14 text-right" />
                          )}
                          <Button size="icon" variant="ghost" onClick={() => updateItem.mutate(i.id)} disabled={updateItem.isPending} title="Save"><Save size={14} /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingItemId(null)} title="Cancel"><X size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={i.id} className="group">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(i.booking_date)}</td>
                      <td className="px-3 py-2">{i.deliverable}</td>
                      <td className="px-3 py-2 text-muted-foreground">{i.description ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{i.session_hours ?? 0}</td>
                      <td className="px-3 py-2 text-right">{formatCents(i.grand_total_cents)}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        <div className="flex items-center justify-end gap-1">
                          <span>{i.debit_kind === "credit" ? `${i.credits_used} cr` : "$"}</span>
                          {isAdmin && (
                            <>
                              <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => startEditItem(i)} title="Edit"><Pencil size={12} /></Button>
                              <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => { if (confirm("Delete this deliverable?")) deleteItem.mutate(i.id); }} title="Delete"><Trash2 size={12} /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
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
          {notesDraft === null ? (
            <div className="space-y-2">
              <div className="text-sm whitespace-pre-wrap text-muted-foreground border border-border rounded-lg p-4 bg-card min-h-[6rem]">
                {project.notes || <span className="italic">No notes yet.</span>}
              </div>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setNotesDraft(project.notes ?? "")}>
                  <Pencil size={12} /> Edit notes
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea rows={8} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Internal project notes…" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveNotes.mutate(notesDraft)} disabled={saveNotes.isPending}>
                  <Save size={12} /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNotesDraft(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="roadmap" className="space-y-3 mt-4">
          <ProjectMilestones projectId={id!} canEdit={true} canApprove={isAdmin} />
        </TabsContent>

        <TabsContent value="payroll" className="space-y-3 mt-4">
          <ProjectAllocations projectId={id!} />
          <p className="text-xs text-muted-foreground">
            When admin runs payroll for a pay period, each member earns their <strong>share %</strong> of payments collected on this project during that window.
          </p>
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