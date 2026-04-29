import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, toCents, formatDate } from "../lib/format";
import { cn } from "@/lib/utils";

type WorkType = "project" | "specialist" | "standard" | "reimbursement";
type Filter = "all" | WorkType;

const WORK_TYPES: { value: WorkType; label: string; tone: string }[] = [
  { value: "project", label: "Project rate", tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  { value: "specialist", label: "Specialist rate", tone: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { value: "standard", label: "Hourly", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "reimbursement", label: "Reimbursement", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
];

const toneFor = (wt: string) => WORK_TYPES.find((w) => w.value === wt)?.tone ?? "bg-muted text-muted-foreground";

export default function TimeAndPay() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [activePeriodId, setActivePeriodId] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [periodForm, setPeriodForm] = useState({ label: "", start_date: "", end_date: "", pay_date: "" });
  const [showPeriodForm, setShowPeriodForm] = useState(false);

  const { data: periods } = useQuery({
    queryKey: ["timesheet_periods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheet_periods").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const periodId = activePeriodId || periods?.[0]?.id || "";

  const { data: timesheet } = useQuery({
    queryKey: ["timesheet", periodId, user?.id],
    enabled: !!periodId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("timesheets").select("*").eq("period_id", periodId).eq("user_id", user!.id).maybeSingle();
      if (data) return data;
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
    const t = { project: 0, specialist: 0, standard: 0, reimbursement: 0, expenses: 0, payroll: 0 };
    (entries ?? []).forEach((e: any) => {
      const h = Number(e.hours) || 0;
      if (e.work_type === "project") t.project += h;
      else if (e.work_type === "specialist") t.specialist += h;
      else if (e.work_type === "reimbursement") t.reimbursement += h;
      else t.standard += h;
      t.expenses += e.expense_cents || 0;
      t.payroll += h * (e.rate_amount_cents || 0);
    });
    t.payroll = Math.round(t.payroll) + t.expenses;
    return t;
  }, [entries]);

  const visibleEntries = useMemo(() => {
    if (filter === "all") return entries ?? [];
    return (entries ?? []).filter((e: any) => e.work_type === filter);
  }, [entries, filter]);

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!timesheet?.id) throw new Error("No timesheet");
      const { error } = await supabase.from("timesheet_entries").insert({
        timesheet_id: timesheet.id,
        deliverable: "",
        work_type: filter === "all" ? "standard" : filter,
        rate_amount_cents: 0,
        hours: 0,
        expense_cents: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet_entries", timesheet?.id] }),
    onError: (e: any) => toast({ title: "Couldn't add row", description: e.message, variant: "destructive" }),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("timesheet_entries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet_entries", timesheet?.id] }),
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
      const { error } = await supabase.from("timesheets").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", timesheet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Submitted for approval" });
      qc.invalidateQueries({ queryKey: ["timesheet", periodId, user?.id] });
    },
  });

  const createPeriod = useMutation({
    mutationFn: async () => {
      if (!periodForm.label || !periodForm.start_date || !periodForm.end_date || !periodForm.pay_date) throw new Error("All fields required");
      const { error } = await supabase.from("timesheet_periods").insert(periodForm);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Period added" });
      setShowPeriodForm(false);
      setPeriodForm({ label: "", start_date: "", end_date: "", pay_date: "" });
      qc.invalidateQueries({ queryKey: ["timesheet_periods"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const isLocked = timesheet?.status !== "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Time &amp; Pay</h1>
          <p className="text-sm text-muted-foreground">Biweekly timesheet — edit rows inline. Pay total auto-calculates from rate × hours + expenses.</p>
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
            <Button size="sm" variant="outline" onClick={() => setShowPeriodForm((s) => !s)}>
              <Plus size={14} /> Period
            </Button>
          )}
        </div>
      </div>

      {showPeriodForm && isAdmin && (
        <div className="border border-border rounded-lg bg-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5 md:col-span-2"><Label>Label</Label><Input placeholder="e.g. May 1–14, 2026" value={periodForm.label} onChange={(e) => setPeriodForm({ ...periodForm, label: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>End</Label><Input type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Pay date</Label><Input type="date" value={periodForm.pay_date} onChange={(e) => setPeriodForm({ ...periodForm, pay_date: e.target.value })} /></div>
          <div className="md:col-span-5 flex justify-end"><Button size="sm" onClick={() => createPeriod.mutate()} disabled={createPeriod.isPending}>Create period</Button></div>
        </div>
      )}

      {!periodId && (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
          No pay periods yet. {isAdmin ? "Add one to get started." : "Ask an admin to create the first period."}
        </div>
      )}

      {periodId && timesheet && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Stat label="Project hrs" value={totals.project.toFixed(2)} />
            <Stat label="Specialist hrs" value={totals.specialist.toFixed(2)} />
            <Stat label="Hourly" value={totals.standard.toFixed(2)} />
            <Stat label="Reimburse hrs" value={totals.reimbursement.toFixed(2)} />
            <Stat label="Expenses" value={formatCents(totals.expenses)} />
            <Stat label="Payroll total" value={formatCents(totals.payroll)} accent />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
              {WORK_TYPES.map((w) => (
                <FilterChip key={w.value} active={filter === w.value} onClick={() => setFilter(w.value)}>{w.label}</FilterChip>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="uppercase tracking-wider text-xs px-2 py-0.5 rounded bg-muted">{timesheet.status}</span>
              {!isLocked && (
                <Button size="sm" onClick={() => submit.mutate()} disabled={(entries ?? []).length === 0 || submit.isPending}>
                  Submit for approval
                </Button>
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 min-w-[200px]">Deliverable</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Day</th>
                  <th className="text-left px-3 py-2">Start</th>
                  <th className="text-left px-3 py-2">End</th>
                  <th className="text-right px-3 py-2">Rate $/hr</th>
                  <th className="text-right px-3 py-2">Hrs</th>
                  <th className="text-right px-3 py-2">Expense</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleEntries.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground italic">No entries{filter !== "all" ? ` for ${filter}` : ""} yet.</td></tr>
                )}
                {visibleEntries.map((e: any) => (
                  <EntryRow
                    key={e.id}
                    entry={e}
                    locked={isLocked}
                    onChange={(patch) => updateEntry.mutate({ id: e.id, patch })}
                    onDelete={() => removeEntry.mutate(e.id)}
                  />
                ))}
              </tbody>
            </table>
            {!isLocked && (
              <div className="border-t border-border p-2">
                <button
                  onClick={() => addEntry.mutate()}
                  className="w-full text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded py-2 flex items-center justify-center gap-1.5 transition"
                >
                  <Plus size={14} /> Add row{filter !== "all" ? ` (${filter})` : ""}
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Rates and totals auto-calc as you type. Reimbursement rows count expenses without payroll hours; project/specialist/hourly rows multiply rate × hours.
          </p>
        </>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border transition",
        active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("border rounded-lg p-3", accent ? "border-foreground bg-foreground text-background" : "border-border bg-card")}>
      <div className={cn("text-[10px] uppercase tracking-wider", accent ? "text-background/70" : "text-muted-foreground")}>{label}</div>
      <div className="text-base font-semibold mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function EntryRow({ entry, locked, onChange, onDelete }: {
  entry: any;
  locked: boolean;
  onChange: (patch: any) => void;
  onDelete: () => void;
}) {
  const [local, setLocal] = useState({
    deliverable: entry.deliverable ?? "",
    work_type: entry.work_type ?? "standard",
    day: entry.day ?? "",
    start_time: entry.start_time ? new Date(entry.start_time).toISOString().slice(11, 16) : "",
    end_time: entry.end_time ? new Date(entry.end_time).toISOString().slice(11, 16) : "",
    rate: ((entry.rate_amount_cents ?? 0) / 100).toString(),
    hours: (entry.hours ?? 0).toString(),
    expense: ((entry.expense_cents ?? 0) / 100).toString(),
  });

  const total = (parseFloat(local.hours) || 0) * (parseFloat(local.rate) || 0) * 100 + (toCents(local.expense));

  const commit = (patch: any) => {
    if (locked) return;
    onChange(patch);
  };

  const cellInput = "w-full bg-transparent text-sm py-1 px-1 outline-none focus:bg-accent/40 rounded transition";
  const cellNum = cn(cellInput, "text-right tabular-nums");

  return (
    <tr className="hover:bg-accent/20">
      <td className="px-3 py-1">
        <input
          disabled={locked}
          value={local.deliverable}
          onChange={(e) => setLocal({ ...local, deliverable: e.target.value })}
          onBlur={() => local.deliverable !== entry.deliverable && commit({ deliverable: local.deliverable })}
          placeholder="What did you do?"
          className={cellInput}
        />
      </td>
      <td className="px-3 py-1">
        <select
          disabled={locked}
          value={local.work_type}
          onChange={(e) => { setLocal({ ...local, work_type: e.target.value }); commit({ work_type: e.target.value }); }}
          className={cn("text-xs px-2 py-1 rounded-full border-0 outline-none cursor-pointer", toneFor(local.work_type))}
        >
          {WORK_TYPES.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </td>
      <td className="px-3 py-1">
        <input
          disabled={locked}
          type="date"
          value={local.day}
          onChange={(e) => { setLocal({ ...local, day: e.target.value }); commit({ day: e.target.value || null }); }}
          className={cn(cellInput, "min-w-[120px]")}
        />
      </td>
      <td className="px-3 py-1">
        <input
          disabled={locked}
          type="time"
          value={local.start_time}
          onChange={(e) => setLocal({ ...local, start_time: e.target.value })}
          onBlur={() => commit({ start_time: local.start_time && local.day ? `${local.day}T${local.start_time}:00` : null })}
          className={cn(cellInput, "min-w-[90px]")}
        />
      </td>
      <td className="px-3 py-1">
        <input
          disabled={locked}
          type="time"
          value={local.end_time}
          onChange={(e) => setLocal({ ...local, end_time: e.target.value })}
          onBlur={() => commit({ end_time: local.end_time && local.day ? `${local.day}T${local.end_time}:00` : null })}
          className={cn(cellInput, "min-w-[90px]")}
        />
      </td>
      <td className="px-3 py-1">
        <input
          disabled={locked}
          type="number" step="0.01" min="0"
          value={local.rate}
          onChange={(e) => setLocal({ ...local, rate: e.target.value })}
          onBlur={() => commit({ rate_amount_cents: toCents(local.rate || "0") })}
          className={cn(cellNum, "max-w-[90px]")}
        />
      </td>
      <td className="px-3 py-1">
        <input
          disabled={locked}
          type="number" step="0.25" min="0"
          value={local.hours}
          onChange={(e) => setLocal({ ...local, hours: e.target.value })}
          onBlur={() => commit({ hours: parseFloat(local.hours) || 0 })}
          className={cn(cellNum, "max-w-[70px]")}
        />
      </td>
      <td className="px-3 py-1">
        <input
          disabled={locked}
          type="number" step="0.01" min="0"
          value={local.expense}
          onChange={(e) => setLocal({ ...local, expense: e.target.value })}
          onBlur={() => commit({ expense_cents: toCents(local.expense || "0") })}
          className={cn(cellNum, "max-w-[90px]")}
        />
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCents(total)}</td>
      <td className="px-2 py-1 text-right">
        {!locked && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1">
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}
