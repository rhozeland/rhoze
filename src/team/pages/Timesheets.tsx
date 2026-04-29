import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, toCents, formatDate } from "../lib/format";

export default function Timesheets() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [periodOpen, setPeriodOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [activePeriodId, setActivePeriodId] = useState<string>("");

  const [periodForm, setPeriodForm] = useState({ label: "", start_date: "", end_date: "", pay_date: "" });
  const [entryForm, setEntryForm] = useState({
    deliverable: "", work_type: "standard", rate: "", day: "",
    start_time: "", end_time: "", hours: "0", expense: "0", notes: "",
  });

  const { data: periods } = useQuery({
    queryKey: ["timesheet_periods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheet_periods").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Auto-pick most recent period
  const periodId = activePeriodId || periods?.[0]?.id || "";

  const { data: timesheet } = useQuery({
    queryKey: ["timesheet", periodId, user?.id],
    enabled: !!periodId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("timesheets").select("*").eq("period_id", periodId).eq("user_id", user!.id).maybeSingle();
      if (data) return data;
      // Auto-create draft
      const { data: created, error } = await supabase.from("timesheets").insert({ period_id: periodId, user_id: user!.id, status: "draft" }).select().single();
      if (error) throw error;
      return created;
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["timesheet_entries", timesheet?.id],
    enabled: !!timesheet?.id,
    queryFn: async () => {
      const { data } = await supabase.from("timesheet_entries").select("*").eq("timesheet_id", timesheet!.id).order("day", { ascending: true });
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const t = { project: 0, specialist: 0, standard: 0, expenses: 0, payroll: 0 };
    (entries ?? []).forEach((e: any) => {
      const h = Number(e.hours) || 0;
      if (e.work_type === "project") t.project += h;
      else if (e.work_type === "specialist") t.specialist += h;
      else t.standard += h;
      t.expenses += e.expense_cents || 0;
      t.payroll += h * (e.rate_amount_cents || 0);
    });
    t.payroll = Math.round(t.payroll);
    return t;
  }, [entries]);

  const createPeriod = useMutation({
    mutationFn: async () => {
      if (!periodForm.label || !periodForm.start_date || !periodForm.end_date || !periodForm.pay_date) throw new Error("All fields required");
      const { error } = await supabase.from("timesheet_periods").insert(periodForm);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Period added" });
      setPeriodOpen(false);
      setPeriodForm({ label: "", start_date: "", end_date: "", pay_date: "" });
      qc.invalidateQueries({ queryKey: ["timesheet_periods"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!timesheet?.id) throw new Error("No timesheet");
      if (!entryForm.deliverable.trim()) throw new Error("Deliverable required");
      const { error } = await supabase.from("timesheet_entries").insert({
        timesheet_id: timesheet.id,
        deliverable: entryForm.deliverable.trim(),
        work_type: entryForm.work_type,
        rate_amount_cents: toCents(entryForm.rate || "0"),
        day: entryForm.day || null,
        start_time: entryForm.start_time ? `${entryForm.day}T${entryForm.start_time}:00` : null,
        end_time: entryForm.end_time ? `${entryForm.day}T${entryForm.end_time}:00` : null,
        hours: parseFloat(entryForm.hours) || 0,
        expense_cents: toCents(entryForm.expense || "0"),
        notes: entryForm.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entry added" });
      setEntryOpen(false);
      setEntryForm({ deliverable: "", work_type: "standard", rate: "", day: "", start_time: "", end_time: "", hours: "0", expense: "0", notes: "" });
      qc.invalidateQueries({ queryKey: ["timesheet_entries", timesheet?.id] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timesheet_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet_entries", timesheet?.id] }),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!timesheet?.id) throw new Error("No timesheet");
      const { error } = await supabase.from("timesheets").update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      }).eq("id", timesheet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Submitted for approval" });
      qc.invalidateQueries({ queryKey: ["timesheet", periodId, user?.id] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Timesheets</h1>
          <p className="text-sm text-muted-foreground">Biweekly hours, expenses, and project work.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodId} onValueChange={setActivePeriodId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Pick a period" /></SelectTrigger>
            <SelectContent>
              {(periods ?? []).map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.label} · pay {formatDate(p.pay_date)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Dialog open={periodOpen} onOpenChange={setPeriodOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus size={14} /> Period</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New pay period</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Label *</Label><Input placeholder="e.g. May 1–14, 2026" value={periodForm.label} onChange={(e) => setPeriodForm({ ...periodForm, label: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Start *</Label><Input type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })} /></div>
                    <div className="space-y-1.5"><Label>End *</Label><Input type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Pay date *</Label><Input type="date" value={periodForm.pay_date} onChange={(e) => setPeriodForm({ ...periodForm, pay_date: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!periodId && <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">No pay periods yet. {isAdmin ? "Add one to get started." : "Ask an admin to create the first period."}</div>}

      {periodId && timesheet && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Project hrs" value={totals.project.toFixed(2)} />
            <Stat label="Specialist hrs" value={totals.specialist.toFixed(2)} />
            <Stat label="Standard hrs" value={totals.standard.toFixed(2)} />
            <Stat label="Expenses" value={formatCents(totals.expenses)} />
            <Stat label="Payroll est." value={formatCents(totals.payroll)} />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              Status: <span className="uppercase tracking-wider text-xs px-2 py-0.5 rounded bg-muted">{timesheet.status}</span>
            </div>
            <div className="flex gap-2">
              {timesheet.status === "draft" && (
                <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus size={14} /> Add row</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New entry</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label>Deliverable *</Label><Input value={entryForm.deliverable} onChange={(e) => setEntryForm({ ...entryForm, deliverable: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Work type</Label>
                          <Select value={entryForm.work_type} onValueChange={(v) => setEntryForm({ ...entryForm, work_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="project">Project</SelectItem>
                              <SelectItem value="specialist">Specialist</SelectItem>
                              <SelectItem value="standard">Standard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5"><Label>Rate ($/hr)</Label><Input type="number" step="0.01" value={entryForm.rate} onChange={(e) => setEntryForm({ ...entryForm, rate: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5"><Label>Day</Label><Input type="date" value={entryForm.day} onChange={(e) => setEntryForm({ ...entryForm, day: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Start</Label><Input type="time" value={entryForm.start_time} onChange={(e) => setEntryForm({ ...entryForm, start_time: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>End</Label><Input type="time" value={entryForm.end_time} onChange={(e) => setEntryForm({ ...entryForm, end_time: e.target.value })} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label>Hours</Label><Input type="number" step="0.25" value={entryForm.hours} onChange={(e) => setEntryForm({ ...entryForm, hours: e.target.value })} /></div>
                        <div className="space-y-1.5"><Label>Expense ($)</Label><Input type="number" step="0.01" value={entryForm.expense} onChange={(e) => setEntryForm({ ...entryForm, expense: e.target.value })} /></div>
                      </div>
                      <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={2} value={entryForm.notes} onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })} /></div>
                    </div>
                    <DialogFooter><Button onClick={() => addEntry.mutate()} disabled={addEntry.isPending}>Save</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {timesheet.status === "draft" && (
                <Button size="sm" onClick={() => submit.mutate()} disabled={(entries ?? []).length === 0 || submit.isPending}>Submit for approval</Button>
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Deliverable</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Day</th>
                  <th className="text-right px-3 py-2">Rate</th>
                  <th className="text-right px-3 py-2">Hrs</th>
                  <th className="text-right px-3 py-2">Expense</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(entries ?? []).length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No entries yet.</td></tr>
                )}
                {(entries ?? []).map((e: any) => {
                  const total = (Number(e.hours) || 0) * (e.rate_amount_cents || 0);
                  return (
                    <tr key={e.id}>
                      <td className="px-3 py-2">{e.deliverable}</td>
                      <td className="px-3 py-2 text-xs uppercase tracking-wider">{e.work_type}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDate(e.day)}</td>
                      <td className="px-3 py-2 text-right">{formatCents(e.rate_amount_cents)}</td>
                      <td className="px-3 py-2 text-right">{Number(e.hours).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{formatCents(e.expense_cents)}</td>
                      <td className="px-3 py-2 text-right">{formatCents(total)}</td>
                      <td className="px-3 py-2 text-right">
                        {timesheet.status === "draft" && (
                          <button onClick={() => removeEntry.mutate(e.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-base font-semibold mt-0.5">{value}</div>
    </div>
  );
}