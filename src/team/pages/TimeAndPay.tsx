import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, X, FileText, DollarSign, Clock, Calendar as CalendarIcon, Receipt, Pencil } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, toCents, formatDate } from "../lib/format";
import { cn } from "@/lib/utils";
import PayrollRun from "../components/PayrollRun";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type WorkType = "project" | "specialist" | "standard" | "reimbursement";

const SPECIALIST_RATE_CENTS = 3000; // $30/hr fixed

const WORK_TYPES: { value: WorkType; label: string; short: string; tone: string }[] = [
  { value: "project",       label: "Project rate",     short: "Project",    tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" },
  { value: "specialist",    label: "Specialist rate",  short: "Specialist", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  { value: "standard",      label: "Hourly",           short: "Hourly",     tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  { value: "reimbursement", label: "Reimbursement",    short: "Reimburse",  tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
];
const toneFor = (wt: string) => WORK_TYPES.find((w) => w.value === wt)?.tone ?? "bg-muted text-muted-foreground border-border";
const labelFor = (wt: string) => WORK_TYPES.find((w) => w.value === wt)?.short ?? wt;

// Diff in hours between two ISO-ish datetime-local strings ("YYYY-MM-DDTHH:MM").
// Each side carries its own day, so all-nighters and same-day tasks both work.
function hoursBetweenDT(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return 0;
  return Math.round(((e - s) / 3600000) * 100) / 100;
}

// Convert an ISO timestamp to a local "YYYY-MM-DDTHH:MM" string for <input type="datetime-local">.
function toLocalDT(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TimeAndPay() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [view, setView] = useState<"mine" | "admin" | "payroll">("mine");
  const [activePeriodId, setActivePeriodId] = useState<string>("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState<string>("");
  const [periodForm, setPeriodForm] = useState(() => defaultBiweeklyPeriod());
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [purging, setPurging] = useState(false);

  const { data: periods } = useQuery({
    queryKey: ["timesheet_periods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheet_periods").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const periodId = activePeriodId || periods?.[0]?.id || "";
  const activePeriod = periods?.find((p: any) => p.id === periodId);

  const today = new Date().toISOString().slice(0, 10);
  const pastPeriods = (periods ?? []).filter((p: any) => p.end_date < today);

  const purgePastPeriods = async () => {
    setPurging(true);
    try {
      const ids = pastPeriods.map((p: any) => p.id);
      if (ids.length === 0) {
        toast({ title: "Nothing to purge", description: "No past periods found." });
        return;
      }
      const { error } = await supabase.from("timesheet_periods").delete().in("id", ids);
      if (error) throw error;
      toast({ title: `Deleted ${ids.length} past period${ids.length === 1 ? "" : "s"}` });
      if (activePeriodId && ids.includes(activePeriodId)) setActivePeriodId("");
      qc.invalidateQueries({ queryKey: ["timesheet_periods"] });
    } catch (e: any) {
      toast({
        title: "Failed to purge periods",
        description: e.message + " (Periods with timesheets or pay stubs cannot be deleted.)",
        variant: "destructive",
      });
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time &amp; Pay</h1>
          <p className="text-sm text-muted-foreground">Biweekly timesheet — totals auto-calculate. Submit when complete; admin approves for payroll.</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 border border-border rounded-lg p-1 bg-muted/30">
            <button onClick={() => setView("mine")} className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition", view === "mine" ? "bg-background shadow-sm" : "text-muted-foreground")}>My timesheet</button>
            <button onClick={() => setView("admin")} className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition", view === "admin" ? "bg-background shadow-sm" : "text-muted-foreground")}>Approval queue</button>
            <button onClick={() => setView("payroll")} className={cn("text-xs px-3 py-1.5 rounded-md font-medium transition", view === "payroll" ? "bg-background shadow-sm" : "text-muted-foreground")}>Run payroll</button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={periodId} onValueChange={setActivePeriodId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Pick a pay period" /></SelectTrigger>
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
        {isAdmin && pastPeriods.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={purging}>
                <Trash2 size={14} /> Purge past ({pastPeriods.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {pastPeriods.length} past pay period{pastPeriods.length === 1 ? "" : "s"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes every period whose end date is before today ({formatDate(today)}).
                  Periods that still have timesheets or pay stubs attached will fail to delete and stay intact.
                  This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={purgePastPeriods}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete past periods
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {activePeriod && (
          <span className="text-xs text-muted-foreground ml-1">
            {formatDate(activePeriod.start_date)} → {formatDate(activePeriod.end_date)}
          </span>
        )}
      </div>

      {showPeriodForm && isAdmin && (
        <PeriodForm form={periodForm} setForm={setPeriodForm} onCreated={() => { setShowPeriodForm(false); setPeriodForm(defaultBiweeklyPeriod()); qc.invalidateQueries({ queryKey: ["timesheet_periods"] }); }} />
      )}

      {!periodId ? (
        isAdmin ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4 text-center">
              No pay periods yet — we pre-filled the current biweekly window. Edit if needed and click <strong>Create period</strong> to open the timesheet.
            </div>
            <PeriodForm form={periodForm} setForm={setPeriodForm} onCreated={() => { setPeriodForm(defaultBiweeklyPeriod()); qc.invalidateQueries({ queryKey: ["timesheet_periods"] }); }} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-8 text-center">
            No pay periods yet. Ask an admin to create the first period.
          </div>
        )
      ) : view === "admin" && isAdmin ? (
        <ApprovalQueue
          periodId={periodId}
          onEditDraft={(sheet) => {
            setEditingUserId(sheet.user_id);
            setEditingUserName(sheet.profile?.display_name || sheet.profile?.alias || sheet.profile?.email || "Team member");
            setView("mine");
          }}
        />
      ) : view === "payroll" && isAdmin && activePeriod ? (
        <PayrollRun period={activePeriod} />
      ) : (
        <MyTimesheet
          periodId={periodId}
          userId={editingUserId || user!.id}
          editorName={editingUserId ? editingUserName : undefined}
          onExitEdit={editingUserId ? () => {
            setEditingUserId(null);
            setEditingUserName("");
          } : undefined}
        />
      )}
    </div>
  );
}

// Biweekly schedule anchored on Apr 22 – May 5, 2026 (payday May 8).
// All future periods step forward in 14-day windows; payday = end + 3 days.
const ANCHOR_START = new Date("2026-04-22T00:00:00");
const PAYDAY_OFFSET_DAYS = 3; // end (Tue) + 3 = Fri payday

function defaultBiweeklyPeriod() {
  const today = new Date();
  const msPerDay = 86400000;
  const daysSinceAnchor = Math.floor((today.getTime() - ANCHOR_START.getTime()) / msPerDay);
  const cyclesAhead = Math.floor(daysSinceAnchor / 14);
  const start = new Date(ANCHOR_START);
  start.setDate(ANCHOR_START.getDate() + cyclesAhead * 14);
  const end = new Date(start); end.setDate(start.getDate() + 13);
  const pay = new Date(end); pay.setDate(end.getDate() + PAYDAY_OFFSET_DAYS);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  return {
    label: `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`,
    start_date: iso(start),
    end_date: iso(end),
    pay_date: iso(pay),
  };
}

function PeriodForm({ form, setForm, onCreated }: any) {
  const create = useMutation({
    mutationFn: async () => {
      if (!form.label || !form.start_date || !form.end_date || !form.pay_date) throw new Error("All fields required");
      const { error } = await supabase.from("timesheet_periods").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Period added" }); onCreated(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="border border-border rounded-lg bg-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
      <div className="space-y-1.5 md:col-span-2"><Label>Label</Label><Input placeholder="e.g. May 1–14, 2026" value={form.label} onChange={(e: any) => setForm({ ...form, label: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>End</Label><Input type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Pay date</Label><Input type="date" value={form.pay_date} onChange={(e: any) => setForm({ ...form, pay_date: e.target.value })} /></div>
      <div className="md:col-span-5 flex justify-end"><Button size="sm" onClick={() => create.mutate()} disabled={create.isPending}>Create period</Button></div>
    </div>
  );
}

/* ---------- MY TIMESHEET ---------- */

function MyTimesheet({ periodId, userId, editorName, onExitEdit }: { periodId: string; userId: string; editorName?: string; onExitEdit?: () => void }) {
  const qc = useQueryClient();

  // Per-person rate from the role mastersheet (used for "Hourly" rows)
  const { data: profile } = useQuery({
    queryKey: ["my_rate", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("hourly_rate_cents").eq("id", userId).maybeSingle();
      return data;
    },
  });
  const myHourlyCents = (profile as any)?.hourly_rate_cents ?? 0;

  const { data: timesheet } = useQuery({
    queryKey: ["timesheet", periodId, userId],
    queryFn: async () => {
      const { data } = await supabase.from("timesheets").select("*").eq("period_id", periodId).eq("user_id", userId).maybeSingle();
      if (data) return data;
      const { data: created, error } = await supabase.from("timesheets").insert({ period_id: periodId, user_id: userId, status: "draft" }).select().single();
      if (error) throw error;
      return created;
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["timesheet_entries", timesheet?.id],
    enabled: !!timesheet?.id,
    queryFn: async () => {
      const { data } = await supabase.from("timesheet_entries").select("*").eq("timesheet_id", timesheet!.id).order("day", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const t = {
      project: 0, specialist: 0, standard: 0,
      standardPay: 0, specialistPay: 0, projectPay: 0,
      expenses: 0, payroll: 0,
    };
    (entries ?? []).forEach((e: any) => {
      const h = Number(e.hours) || 0;
      const rate = e.rate_amount_cents || 0;
      if (e.work_type === "specialist") { t.specialist += h; t.specialistPay += h * SPECIALIST_RATE_CENTS; }
      else if (e.work_type === "project") { t.project += 1; t.projectPay += rate; } // flat
      else if (e.work_type === "reimbursement") { /* expense-only */ }
      else { t.standard += h; t.standardPay += h * rate; }
      t.expenses += e.expense_cents || 0;
    });
    t.payroll = Math.round(t.standardPay + t.specialistPay + t.projectPay) + t.expenses;
    return t;
  }, [entries]);

  const visible = entries ?? [];

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!timesheet?.id) throw new Error("No timesheet");
      const { error } = await supabase.from("timesheet_entries").insert({
        timesheet_id: timesheet.id, deliverable: "", work_type: "standard",
        rate_amount_cents: myHourlyCents, hours: 0, expense_cents: 0,
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
    mutationFn: async (id: string) => { const { error } = await supabase.from("timesheet_entries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet_entries", timesheet?.id] }),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!timesheet?.id) throw new Error("No timesheet");
      const { error } = await supabase.from("timesheets").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", timesheet.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Submitted for approval" }); qc.invalidateQueries({ queryKey: ["timesheet", periodId, userId] }); },
  });

  const saveDraft = useMutation({
    mutationFn: async () => {
      if (!timesheet?.id) throw new Error("No timesheet");
      const { error } = await supabase.from("timesheets").update({ status: "draft", submitted_at: null }).eq("id", timesheet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Draft saved" });
      qc.invalidateQueries({ queryKey: ["timesheet", periodId, userId] });
      qc.invalidateQueries({ queryKey: ["admin_timesheets", periodId] });
    },
    onError: (e: any) => toast({ title: "Couldn't save draft", description: e.message, variant: "destructive" }),
  });

  const recall = useMutation({
    mutationFn: async () => {
      if (!timesheet?.id) throw new Error("No timesheet");
      const { error } = await supabase.from("timesheets").update({ status: "draft", submitted_at: null }).eq("id", timesheet.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet", periodId, userId] }),
  });

  if (!timesheet) return null;
  const isLocked = timesheet.status !== "draft";

  return (
    <div className="space-y-4">
      {editorName && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <div className="text-sm font-medium">Editing saved draft</div>
            <div className="text-xs text-muted-foreground">{editorName}&rsquo;s timesheet for this pay period</div>
          </div>
          {onExitEdit && <Button size="sm" variant="outline" onClick={onExitEdit}>Done</Button>}
        </div>
      )}

      {/* Spreadsheet-style header banner */}
      <div className="rounded-lg overflow-hidden border border-border bg-card">
        <div className="bg-orange-500 text-white px-5 py-4 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] opacity-80">Rhozeland</div>
            <div className="text-xl md:text-2xl font-bold tracking-tight">Biweekly Timesheet</div>
          </div>
          <StatusPill status={timesheet.status} />
        </div>
        {/* Summary strip — like the orange totals row in the spreadsheet */}
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-border border-t border-border bg-orange-50/60 dark:bg-orange-500/5">
          <SummaryCell icon={<Clock size={13} />} label="Project hrs" value={totals.project.toFixed(2)} />
          <SummaryCell icon={<Clock size={13} />} label="Specialist hrs" value={totals.specialist.toFixed(2)} />
          <SummaryCell icon={<Clock size={13} />} label="Hourly hrs" value={totals.standard.toFixed(2)} />
          <SummaryCell icon={<Receipt size={13} />} label="Total expenses" value={formatCents(totals.expenses)} />
          <SummaryCell icon={<DollarSign size={13} />} label="Payroll total" value={formatCents(totals.payroll)} highlight />
        </div>
      </div>

      {/* Live breakdown table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground bg-muted/40 border-b border-border">
          Pay breakdown
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Category</th>
              <th className="text-right px-4 py-2 font-medium">Hours</th>
              <th className="text-right px-4 py-2 font-medium">Rate</th>
              <th className="text-right px-4 py-2 font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-4 py-2">Standard (hourly)</td>
              <td className="px-4 py-2 text-right tabular-nums">{totals.standard.toFixed(2)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">per row</td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCents(Math.round(totals.standardPay))}</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Specialist</td>
              <td className="px-4 py-2 text-right tabular-nums">{totals.specialist.toFixed(2)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">$30.00/hr</td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCents(Math.round(totals.specialistPay))}</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Project (flat)</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">flat</td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCents(Math.round(totals.projectPay))}</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Reimbursements / expenses</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">—</td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCents(totals.expenses)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-orange-500/10 border-t border-border">
              <td className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[11px]" colSpan={3}>Payroll total</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-bold">{formatCents(totals.payroll)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end flex-wrap gap-2">
          {!isLocked && (
            <Button size="sm" variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending}>
              Save draft
            </Button>
          )}
          {isLocked && timesheet.status === "submitted" && (
            <Button size="sm" variant="ghost" onClick={() => recall.mutate()}>Recall</Button>
          )}
          {!isLocked && (
            <Button size="sm" onClick={() => submit.mutate()} disabled={(entries ?? []).length === 0 || submit.isPending}>
              Submit for approval
            </Button>
          )}
      </div>

      {/* Spreadsheet table */}
      <div className="border border-border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-orange-500 text-white text-[11px] uppercase tracking-wider">
            <tr>
              <Th icon={<FileText size={12} />} className="text-left min-w-[220px]">Deliverable</Th>
              <Th className="text-left">Type</Th>
              <Th icon={<DollarSign size={12} />} className="text-right">Rate</Th>
              <Th icon={<Clock size={12} />} className="text-left">Start</Th>
              <Th icon={<Clock size={12} />} className="text-left">End</Th>
              <Th className="text-right">Hours</Th>
              <Th icon={<Receipt size={12} />} className="text-right">Expenses</Th>
              <Th className="text-right">Total</Th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground italic">No entries yet. Click below to add one.</td></tr>
            )}
            {visible.map((e: any, i: number) => (
              <EntryRow key={e.id} entry={e} stripe={i % 2 === 1} locked={isLocked} myHourlyCents={myHourlyCents} onChange={(p) => updateEntry.mutate({ id: e.id, patch: p })} onDelete={() => removeEntry.mutate(e.id)} />
            ))}
          </tbody>
        </table>
        {!isLocked && (
          <div className="border-t border-border p-2">
            <button onClick={() => addEntry.mutate()} className="w-full text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded py-2 flex items-center justify-center gap-1.5 transition">
              <Plus size={14} /> Add row
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Rates auto-fill by type — <strong>Hourly</strong> uses your role rate, <strong>Specialist</strong> is $30/hr fixed, <strong>Project</strong> is a flat amount you enter, <strong>Reimbursement</strong> uses the expense column. Enter start &amp; end times to auto-calculate hours.
      </p>
    </div>
  );
}

/* ---------- ADMIN APPROVAL QUEUE ---------- */

function ApprovalQueue({ periodId, onEditDraft }: { periodId: string; onEditDraft: (sheet: any) => void }) {
  const qc = useQueryClient();
  const { data: sheets } = useQuery({
    queryKey: ["admin_timesheets", periodId],
    queryFn: async () => {
      const { data } = await supabase.from("timesheets").select("*").eq("period_id", periodId).order("submitted_at", { ascending: false, nullsFirst: false });
      const rows = data ?? [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id)));
      const sheetIds = rows.map((r: any) => r.id);
      const [{ data: profs }, { data: ents }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, display_name, alias, email").in("id", userIds) : Promise.resolve({ data: [] }) as any,
        sheetIds.length ? supabase.from("timesheet_entries").select("timesheet_id, work_type, hours, rate_amount_cents, expense_cents").in("timesheet_id", sheetIds) : Promise.resolve({ data: [] }) as any,
      ]);
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const emap = new Map<string, any[]>();
      (ents ?? []).forEach((e: any) => { const a = emap.get(e.timesheet_id) ?? []; a.push(e); emap.set(e.timesheet_id, a); });
      return rows.map((r: any) => {
        const es = emap.get(r.id) ?? [];
        let payroll = 0, expenses = 0, hrs = 0;
        es.forEach((e: any) => { const h = Number(e.hours) || 0; hrs += h; expenses += e.expense_cents || 0; if (e.work_type !== "reimbursement") payroll += h * (e.rate_amount_cents || 0); });
        return { ...r, profile: pmap.get(r.user_id), entry_count: es.length, total_hours: hrs, total_expenses: expenses, total_payroll: Math.round(payroll) + expenses };
      });
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "draft" }) => {
      const patch: any = { status, approved_at: status === "approved" ? new Date().toISOString() : null };
      if (status === "draft") patch.submitted_at = null;
      const { error } = await supabase.from("timesheets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => { toast({ title: vars.status === "approved" ? "Approved" : "Sent back" }); qc.invalidateQueries({ queryKey: ["admin_timesheets", periodId] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteDraft = useMutation({
    mutationFn: async (id: string) => {
      const { error: entriesError } = await supabase.from("timesheet_entries").delete().eq("timesheet_id", id);
      if (entriesError) throw entriesError;
      const { error } = await supabase.from("timesheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Draft deleted" });
      qc.invalidateQueries({ queryKey: ["admin_timesheets", periodId] });
    },
    onError: (e: any) => toast({ title: "Couldn't delete draft", description: e.message, variant: "destructive" }),
  });

  const submitted = (sheets ?? []).filter((s: any) => s.status === "submitted");
  const approved  = (sheets ?? []).filter((s: any) => s.status === "approved");
  const drafts    = (sheets ?? []).filter((s: any) => s.status === "draft");

  return (
    <div className="space-y-6">
      <Section title="Awaiting approval" count={submitted.length} accent>
        {submitted.length === 0 ? <Empty>No timesheets waiting.</Empty> : submitted.map((s: any) => (
          <SheetRow key={s.id} sheet={s}
            actions={<>
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: "draft" })}><X size={14} /> Send back</Button>
              <Button size="sm" onClick={() => setStatus.mutate({ id: s.id, status: "approved" })}><Check size={14} /> Approve</Button>
            </>} />
        ))}
      </Section>
      <Section title="Approved" count={approved.length}>
        {approved.length === 0 ? <Empty>None yet.</Empty> : approved.map((s: any) => (
          <SheetRow key={s.id} sheet={s}
            actions={<Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "draft" })}>Reopen</Button>} />
        ))}
      </Section>
      <Section title="In progress (drafts)" count={drafts.length} muted>
        {drafts.length === 0 ? <Empty>Nobody in draft.</Empty> : drafts.map((s: any) => (
          <SheetRow
            key={s.id}
            sheet={s}
            actions={
              <>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 border-orange-500/40 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-300"
                  onClick={() => onEditDraft(s)}
                  aria-label={`Edit saved draft for ${s.profile?.display_name || s.profile?.alias || s.profile?.email || "team member"}`}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => deleteDraft.mutate(s.id)}
                  disabled={deleteDraft.isPending}
                  aria-label={`Delete draft for ${s.profile?.display_name || s.profile?.alias || s.profile?.email || "team member"}`}
                >
                  <X size={14} />
                </Button>
              </>
            }
          />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, count, accent, muted, children }: any) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h2 className={cn("text-sm font-semibold", accent && "text-orange-600 dark:text-orange-400", muted && "text-muted-foreground")}>{title}</h2>
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Empty({ children }: any) { return <div className="text-xs text-muted-foreground italic border border-dashed border-border rounded-lg p-4">{children}</div>; }

function SheetRow({ sheet, actions }: { sheet: any; actions?: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg bg-card p-3 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium text-sm">{sheet.profile?.display_name || sheet.profile?.alias || sheet.profile?.email || "Team member"}</div>
        <div className="text-xs text-muted-foreground">
          {sheet.entry_count} {sheet.entry_count === 1 ? "row" : "rows"} · {Number(sheet.total_hours).toFixed(2)} hrs
          {sheet.submitted_at && ` · submitted ${formatDate(sheet.submitted_at)}`}
          {sheet.approved_at && ` · approved ${formatDate(sheet.approved_at)}`}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-muted-foreground">Payroll</div>
        <div className="font-semibold tabular-nums">{formatCents(sheet.total_payroll)}</div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- shared bits ---------- */

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-white/20 text-white",
    submitted: "bg-amber-200 text-amber-900",
    approved: "bg-emerald-200 text-emerald-900",
  };
  const label: Record<string, string> = { draft: "Draft", submitted: "Awaiting approval", approved: "Approved" };
  return <span className={cn("text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold", map[status] ?? "bg-white/20 text-white")}>{label[status] ?? status}</span>;
}

function FilterChip({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} className={cn("text-xs px-3 py-1.5 rounded-full border transition", active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40")}>{children}</button>
  );
}

function SummaryCell({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("px-4 py-3", highlight && "bg-orange-500 text-white")}>
      <div className={cn("text-[10px] uppercase tracking-wider flex items-center gap-1", highlight ? "text-white/80" : "text-muted-foreground")}>
        {icon}{label}
      </div>
      <div className="text-base md:text-lg font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function Th({ children, className, icon }: any) {
  return <th className={cn("px-3 py-2 font-semibold", className)}><span className="inline-flex items-center gap-1">{icon}{children}</span></th>;
}

/* ---------- entry row ---------- */

function EntryRow({ entry, stripe, locked, myHourlyCents, onChange, onDelete }: { entry: any; stripe: boolean; locked: boolean; myHourlyCents: number; onChange: (p: any) => void; onDelete: () => void }) {
  const [local, setLocal] = useState({
    deliverable: entry.deliverable ?? "",
    work_type: entry.work_type ?? "standard",
    start_time: entry.start_time ? toLocalDT(entry.start_time) : "",
    end_time: entry.end_time ? toLocalDT(entry.end_time) : "",
    rate: ((entry.rate_amount_cents ?? 0) / 100).toString(),
    hours: (Number(entry.hours) || 0).toString(),
    expense: ((entry.expense_cents ?? 0) / 100).toString(),
  });

  const isReimburse = local.work_type === "reimbursement";
  const isProject   = local.work_type === "project";
  const isSpecialist = local.work_type === "specialist";
  const isHourly    = local.work_type === "standard";

  // Rate column behavior:
  //  - Hourly     → editable, defaults to user's role rate
  //  - Specialist → locked at $30/hr
  //  - Project    → editable flat amount (rate = total)
  //  - Reimburse  → N/A
  const rateLocked = locked || isReimburse || isSpecialist;

  const lineTotal = isReimburse
    ? toCents(local.expense || "0")
    : isProject
      ? toCents(local.rate || "0")
      : isSpecialist
        ? Math.round((parseFloat(local.hours) || 0) * SPECIALIST_RATE_CENTS) + toCents(local.expense || "0")
        : Math.round((parseFloat(local.hours) || 0) * (parseFloat(local.rate) || 0) * 100) + toCents(local.expense || "0");

  const commit = (patch: any) => { if (!locked) onChange(patch); };

  // When the work type changes, snap the rate to the right default
  const handleTypeChange = (next: string) => {
    let nextRateCents = entry.rate_amount_cents ?? 0;
    if (next === "specialist") nextRateCents = SPECIALIST_RATE_CENTS;
    else if (next === "standard") nextRateCents = myHourlyCents || 0;
    else if (next === "reimbursement") nextRateCents = 0;
    // project keeps whatever was there (user-entered flat)
    setLocal({ ...local, work_type: next, rate: (nextRateCents / 100).toString() });
    commit({ work_type: next, rate_amount_cents: nextRateCents });
  };

  // When start/end (each carrying their own date) change, auto-fill hours.
  // Also stamp `day` from the start side for backward compatibility.
  const recalcHours = (start: string, end: string) => {
    const h = hoursBetweenDT(start, end);
    const startISO = start ? new Date(start).toISOString() : null;
    const endISO = end ? new Date(end).toISOString() : null;
    const day = start ? start.slice(0, 10) : null;
    if (h > 0) {
      setLocal((s) => ({ ...s, hours: h.toString() }));
      commit({ hours: h, start_time: startISO, end_time: endISO, day });
    } else {
      commit({ start_time: startISO, end_time: endISO, day });
    }
  };

  const cell = "w-full bg-transparent text-sm py-1 px-1.5 outline-none focus:bg-accent/40 rounded transition disabled:opacity-60";
  const cellNum = cn(cell, "text-right tabular-nums");

  return (
    <tr className={cn("hover:bg-accent/20", stripe && "bg-muted/20")}>
      <td className="px-2 py-1">
        <input disabled={locked} value={local.deliverable}
          onChange={(e) => setLocal({ ...local, deliverable: e.target.value })}
          onBlur={() => local.deliverable !== entry.deliverable && commit({ deliverable: local.deliverable })}
          placeholder="What did you do?" className={cell} />
      </td>
      <td className="px-2 py-1">
        <select disabled={locked} value={local.work_type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className={cn("text-xs px-2 py-1 rounded-full border outline-none cursor-pointer font-medium", toneFor(local.work_type))}>
          {WORK_TYPES.map((w) => <option key={w.value} value={w.value} className="bg-background text-foreground">{w.short}</option>)}
        </select>
      </td>
      <td className="px-2 py-1">
        <input disabled={rateLocked} type="number" step="0.01" min="0"
          value={isReimburse ? "" : isSpecialist ? "30.00" : local.rate}
          placeholder={isReimburse ? "—" : isProject ? "flat $" : "0.00"}
          title={isSpecialist ? "Specialist rate is locked at $30/hr" : undefined}
          onChange={(e) => setLocal({ ...local, rate: e.target.value })}
          onBlur={() => commit({ rate_amount_cents: toCents(local.rate || "0") })}
          className={cn(cellNum, "max-w-[90px]", isSpecialist && "font-semibold opacity-90")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked || isReimburse} type="datetime-local" value={local.start_time}
          onChange={(e) => setLocal({ ...local, start_time: e.target.value })}
          onBlur={() => recalcHours(local.start_time, local.end_time)}
          className={cn(cell, "min-w-[170px]")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked || isReimburse} type="datetime-local" value={local.end_time}
          onChange={(e) => setLocal({ ...local, end_time: e.target.value })}
          onBlur={() => recalcHours(local.start_time, local.end_time)}
          className={cn(cell, "min-w-[170px]")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked || isReimburse} type="number" step="0.25" min="0"
          value={isReimburse ? "" : local.hours}
          placeholder={isReimburse ? "—" : "0.00"}
          onChange={(e) => setLocal({ ...local, hours: e.target.value })}
          onBlur={() => commit({ hours: parseFloat(local.hours) || 0 })}
          className={cn(cellNum, "max-w-[70px]")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked} type="number" step="0.01" min="0"
          value={local.expense}
          onChange={(e) => setLocal({ ...local, expense: e.target.value })}
          onBlur={() => commit({ expense_cents: toCents(local.expense || "0") })}
          className={cn(cellNum, "max-w-[90px]")} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCents(lineTotal)}</td>
      <td className="px-2 py-1 text-right">
        {!locked && <button onClick={onDelete} className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={14} /></button>}
      </td>
    </tr>
  );
}
