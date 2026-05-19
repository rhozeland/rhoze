import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Check, X, FileText, DollarSign, Clock, Calendar as CalendarIcon, Receipt, Pencil, Copy, Loader2, AlertCircle, Undo2 } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatCents, toCents, formatDate } from "../lib/format";
import { cn } from "@/lib/utils";
import PayrollRun from "../components/PayrollRun";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

type SaveStatus = "saving" | "saved" | "error" | undefined;

/**
 * Per-entry save manager: optimistic cache updates, debounced patch coalescing,
 * exponential backoff on transient errors, and a per-row status the UI can render.
 *
 * Typed deliverables / hours / rates are written to the cache immediately so they
 * never visually disappear, and the actual Supabase write is retried up to ~5s of
 * backoff. If we still can't reach the server, the patch stays queued and we try
 * again every 5s in the background — so a flaky connection never loses input.
 */
function useEntrySaver(queryKey: any[]) {
  const qc = useQueryClient();
  const pending = useRef<Map<string, any>>(new Map());
  const timers = useRef<Map<string, any>>(new Map());
  const inflight = useRef<Map<string, boolean>>(new Map());
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});

  const setOne = (id: string, s: SaveStatus) =>
    setStatus((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }));

  const flush = useCallback(async (id: string) => {
    if (inflight.current.get(id)) return;
    const patch = pending.current.get(id);
    if (!patch || Object.keys(patch).length === 0) return;
    pending.current.delete(id);
    inflight.current.set(id, true);
    setOne(id, "saving");

    let attempt = 0;
    let lastErr: any = null;
    // ~5 retries with backoff (300ms, 600, 1200, 2400, 4000)
    while (attempt < 6) {
      const { error } = await supabase.from("timesheet_entries").update(patch).eq("id", id);
      if (!error) { lastErr = null; break; }
      lastErr = error;
      attempt++;
      if (attempt >= 6) break;
      await new Promise((r) => setTimeout(r, Math.min(300 * 2 ** (attempt - 1), 4000)));
    }

    inflight.current.set(id, false);

    if (lastErr) {
      // Keep the patch (merged with anything new) and try again in 5s — never lose input.
      const merged = { ...patch, ...(pending.current.get(id) ?? {}) };
      pending.current.set(id, merged);
      setOne(id, "error");
      setTimeout(() => flush(id), 5000);
      return;
    }

    // Anything new queued during the request? Flush again right away.
    if (pending.current.has(id)) {
      flush(id);
    } else {
      setOne(id, "saved");
      setTimeout(() => {
        setStatus((prev) => (prev[id] === "saved" ? { ...prev, [id]: undefined } : prev));
      }, 1500);
    }
  }, []);

  const save = useCallback((id: string, patch: any) => {
    if (!id || !patch || Object.keys(patch).length === 0) return;
    // Optimistic cache patch — UI is the source of truth immediately.
    qc.setQueryData<any[]>(queryKey, (old) =>
      (old ?? []).map((e: any) => (e.id === id ? { ...e, ...patch } : e))
    );
    pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...patch });
    setOne(id, "saving");
    if (timers.current.has(id)) clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => flush(id), 300));
  }, [qc, JSON.stringify(queryKey), flush]);

  // Force-flush every pending patch right now (used by Save draft / Submit).
  const flushAll = useCallback(async () => {
    const ids = Array.from(pending.current.keys());
    ids.forEach((id) => {
      if (timers.current.has(id)) clearTimeout(timers.current.get(id));
    });
    await Promise.all(ids.map((id) => flush(id)));
  }, [flush]);

  return { save, status, flushAll };
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
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
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

  const [showPurgeDialog, setShowPurgeDialog] = useState(false);
  const [selectedPeriodIds, setSelectedPeriodIds] = useState<Set<string>>(new Set());

  const openPurgeDialog = () => {
    const preselected = new Set(pastPeriods.map((p: any) => p.id));
    setSelectedPeriodIds(preselected);
    setShowPurgeDialog(true);
  };

  const togglePeriodSelection = (id: string) => {
    setSelectedPeriodIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const purgeSelectedPeriods = async () => {
    setPurging(true);
    try {
      const ids = Array.from(selectedPeriodIds);
      if (ids.length === 0) {
        toast({ title: "Nothing selected", description: "Select at least one period to delete." });
        return;
      }
      const { error } = await supabase.from("timesheet_periods").delete().in("id", ids);
      if (error) throw error;
      toast({ title: `Deleted ${ids.length} period${ids.length === 1 ? "" : "s"}` });
      if (activePeriodId && ids.includes(activePeriodId)) setActivePeriodId("");
      setShowPurgeDialog(false);
      qc.invalidateQueries({ queryKey: ["timesheet_periods"] });
    } catch (e: any) {
      toast({
        title: "Failed to delete periods",
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
        {isAdmin && activePeriod && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingPeriodId(activePeriod.id);
              setPeriodForm({
                label: activePeriod.label,
                start_date: activePeriod.start_date,
                end_date: activePeriod.end_date,
                pay_date: activePeriod.pay_date,
              });
              setShowPeriodForm(true);
            }}
          >
            <Pencil size={14} /> Edit period
          </Button>
        )}
        {isAdmin && (periods ?? []).length > 1 && (
          <Dialog open={showPurgeDialog} onOpenChange={setShowPurgeDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                <Trash2 size={14} /> Delete periods
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Delete pay periods</DialogTitle>
                <DialogDescription>
                  Select the periods you want to remove. The currently active period is protected and cannot be deleted.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox
                    checked={(() => {
                      const deletable = (periods ?? []).filter((p: any) => p.id !== periodId).map((p: any) => p.id);
                      return deletable.length > 0 && deletable.every((id: string) => selectedPeriodIds.has(id));
                    })()}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const deletable = (periods ?? []).filter((p: any) => p.id !== periodId).map((p: any) => p.id);
                        setSelectedPeriodIds(new Set(deletable));
                      } else {
                        setSelectedPeriodIds(new Set());
                      }
                    }}
                  />
                  <span className="font-medium">Select all (except active)</span>
                </label>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => setSelectedPeriodIds(new Set())}
                >
                  Clear selection
                </button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {(periods ?? []).map((p: any) => {
                  const isActive = p.id === periodId;
                  const isPast = p.end_date < today;
                  return (
                    <label
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer transition",
                        isActive
                          ? "border-amber-500/30 bg-amber-500/10 cursor-not-allowed opacity-70"
                          : "border-border hover:bg-accent/30",
                        selectedPeriodIds.has(p.id) && !isActive && "bg-destructive/10 border-destructive/30"
                      )}
                    >
                      <Checkbox
                        checked={selectedPeriodIds.has(p.id)}
                        disabled={isActive}
                        onCheckedChange={() => togglePeriodSelection(p.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{p.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(p.start_date)} → {formatDate(p.end_date)} · pay {formatDate(p.pay_date)}
                          {isActive && <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold">(active)</span>}
                          {isPast && !isActive && <span className="ml-1 text-muted-foreground">(past)</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                <Button variant="ghost" size="sm" onClick={() => setShowPurgeDialog(false)}>Cancel</Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={purging || selectedPeriodIds.size === 0}
                  onClick={purgeSelectedPeriods}
                >
                  {purging ? <Clock size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete {selectedPeriodIds.size} selected
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {activePeriod && (
          <span className="text-xs text-muted-foreground ml-1">
            {formatDate(activePeriod.start_date)} → {formatDate(activePeriod.end_date)}
          </span>
        )}
      </div>

      {showPeriodForm && isAdmin && (
        <PeriodForm
          form={periodForm}
          setForm={setPeriodForm}
          editingId={editingPeriodId}
          onCancel={() => { setShowPeriodForm(false); setEditingPeriodId(null); setPeriodForm(defaultBiweeklyPeriod()); }}
          onCreated={() => {
            setShowPeriodForm(false);
            setEditingPeriodId(null);
            setPeriodForm(defaultBiweeklyPeriod());
            qc.invalidateQueries({ queryKey: ["timesheet_periods"] });
          }}
        />
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
          adminEdit={!!editingUserId && isAdmin}
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

function PeriodForm({ form, setForm, onCreated, editingId, onCancel }: any) {
  const save = useMutation({
    mutationFn: async () => {
      if (!form.label || !form.start_date || !form.end_date || !form.pay_date) throw new Error("All fields required");
      if (editingId) {
        // Update ONLY the period row's metadata. timesheets, entries, and pay stubs
        // reference period_id which is unchanged — all employee data stays intact.
        const { error } = await supabase
          .from("timesheet_periods")
          .update({
            label: form.label,
            start_date: form.start_date,
            end_date: form.end_date,
            pay_date: form.pay_date,
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("timesheet_periods").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast({ title: editingId ? "Period updated" : "Period added" }); onCreated(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  return (
    <div className="border border-border rounded-lg bg-card p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
      <div className="space-y-1.5 md:col-span-2"><Label>Label</Label><Input placeholder="e.g. May 1–14, 2026" value={form.label} onChange={(e: any) => setForm({ ...form, label: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>End</Label><Input type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Pay date</Label><Input type="date" value={form.pay_date} onChange={(e: any) => setForm({ ...form, pay_date: e.target.value })} /></div>
      <div className="md:col-span-5 flex justify-end gap-2">
        {onCancel && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {editingId ? "Save changes" : "Create period"}
        </Button>
      </div>
    </div>
  );
}

/* ---------- MY TIMESHEET ---------- */

function MyTimesheet({ periodId, userId, editorName, adminEdit, onExitEdit }: { periodId: string; userId: string; editorName?: string; adminEdit?: boolean; onExitEdit?: () => void }) {
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

  // Optimistic / retrying saver for entry cells.
  const entryQK = ["timesheet_entries", timesheet?.id];
  const { save: saveCell, status: saveStatus, flushAll: flushAllCells } = useEntrySaver(entryQK);

  // Warn before unload if anything is still in flight, so a stray tab close
  // never silently drops an unsaved keystroke.
  useEffect(() => {
    const pending = Object.values(saveStatus).some((s) => s === "saving" || s === "error");
    if (!pending) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

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


  const removeEntry = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("timesheet_entries").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet_entries", timesheet?.id] }),
    onError: (e: any) => toast({ title: "Couldn't delete row", description: e.message, variant: "destructive" }),
  });

  const duplicateEntry = useMutation({
    mutationFn: async (src: any) => {
      if (!timesheet?.id) throw new Error("No timesheet");
      const { id, created_at, updated_at, ...rest } = src;
      const { error } = await supabase.from("timesheet_entries").insert({
        ...rest,
        timesheet_id: timesheet.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Row duplicated" });
      qc.invalidateQueries({ queryKey: ["timesheet_entries", timesheet?.id] });
    },
    onError: (e: any) => toast({ title: "Couldn't duplicate", description: e.message, variant: "destructive" }),
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
  const isLocked = timesheet.status !== "draft" && !adminEdit;

  return (
    <MyTimesheetView
      timesheet={timesheet}
      entries={entries ?? []}
      visible={visible}
      totals={totals}
      isLocked={isLocked}
      adminEdit={!!adminEdit}
      editorName={editorName}
      onExitEdit={onExitEdit}
      myHourlyCents={myHourlyCents}
      saveStatus={saveStatus}
      saveCell={saveCell}
      flushAllCells={flushAllCells}
      addEntry={addEntry}
      removeEntry={removeEntry}
      duplicateEntry={duplicateEntry}
      submit={submit}
      recall={recall}
    />
  );
}

function MyTimesheetView(props: any) {
  const { timesheet, entries, visible, totals, isLocked, adminEdit, editorName, onExitEdit,
          myHourlyCents, saveStatus, saveCell, flushAllCells,
          addEntry, removeEntry, duplicateEntry, submit, recall } = props;

  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ deliverable: string; work_type: string; rate: string; hours: string; expense: string }>({
    deliverable: "", work_type: "", rate: "", hours: "", expense: "",
  });

  const allIds = visible.map((e: any) => e.id);
  const allSelected = allIds.length > 0 && allIds.every((id: string) => selected.has(id));
  const someSelected = selected.size > 0 && !allSelected;

  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const clearSel = () => setSelected(new Set());

  const applyBulk = () => {
    if (selected.size === 0) { toast({ title: "Select rows first" }); return; }
    const patch: any = {};
    if (bulk.deliverable !== "") patch.deliverable = bulk.deliverable;
    if (bulk.work_type !== "")   patch.work_type = bulk.work_type;
    if (bulk.rate !== "")        patch.rate_amount_cents = toCents(bulk.rate || "0");
    if (bulk.hours !== "")       patch.hours = parseFloat(bulk.hours) || 0;
    if (bulk.expense !== "")     patch.expense_cents = toCents(bulk.expense || "0");
    if (Object.keys(patch).length === 0) { toast({ title: "Enter a value to apply" }); return; }
    // Snap rate to fixed value when type forces it
    selected.forEach((id) => {
      const p = { ...patch };
      if (p.work_type === "specialist") p.rate_amount_cents = SPECIALIST_RATE_CENTS;
      if (p.work_type === "standard" && bulk.rate === "") p.rate_amount_cents = myHourlyCents || 0;
      if (p.work_type === "reimbursement" && bulk.rate === "") p.rate_amount_cents = 0;
      saveCell(id, p);
    });
    toast({ title: `Applied to ${selected.size} row${selected.size === 1 ? "" : "s"}` });
    setBulk({ deliverable: "", work_type: "", rate: "", hours: "", expense: "" });
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} row${selected.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    const ids = Array.from(selected);
    for (const id of ids) await removeEntry.mutateAsync(id).catch(() => {});
    clearSel();
  };

  const bulkCol = bulkMode && adminEdit;

  return (
    <div className="space-y-4">
      {editorName && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <div className="text-sm font-medium">
              {adminEdit && timesheet.status !== "draft"
                ? `Admin edit mode — ${timesheet.status} timesheet`
                : "Editing saved draft"}
            </div>
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
          {adminEdit && !isLocked && (
            <Button size="sm" variant={bulkMode ? "default" : "outline"} onClick={() => { setBulkMode(!bulkMode); clearSel(); }}>
              {bulkMode ? "Exit bulk edit" : "Bulk edit"}
            </Button>
          )}
          {isLocked && timesheet.status === "submitted" && (
            <Button size="sm" variant="ghost" onClick={() => recall.mutate()}>Recall</Button>
          )}
          {!isLocked && (
            <Button size="sm" onClick={async () => { (document.activeElement as HTMLElement)?.blur?.(); await flushAllCells(); submit.mutate(); }} disabled={(entries ?? []).length === 0 || submit.isPending}>
              Submit for approval
            </Button>
          )}
      </div>

      {bulkCol && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/5 p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-300">
              Bulk edit · {selected.size} selected
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={toggleAll}>{allSelected ? "Clear all" : "Select all"}</Button>
              <Button size="sm" variant="ghost" onClick={clearSel} disabled={selected.size === 0}>Reset</Button>
              <Button size="sm" variant="outline" onClick={deleteSelected} disabled={selected.size === 0} className="border-destructive/40 text-destructive hover:bg-destructive/10">Delete</Button>
              <Button size="sm" onClick={applyBulk} disabled={selected.size === 0}>Apply to selected</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Input placeholder="Deliverable" value={bulk.deliverable} onChange={(e: any) => setBulk({ ...bulk, deliverable: e.target.value })} className="h-9" />
            <select value={bulk.work_type} onChange={(e) => setBulk({ ...bulk, work_type: e.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Type — keep</option>
              {WORK_TYPES.map((w) => <option key={w.value} value={w.value}>{w.short}</option>)}
            </select>
            <Input type="number" step="0.01" min="0" placeholder="Rate $/hr" value={bulk.rate} onChange={(e: any) => setBulk({ ...bulk, rate: e.target.value })} className="h-9" />
            <Input type="number" step="0.25" min="0" placeholder="Hours" value={bulk.hours} onChange={(e: any) => setBulk({ ...bulk, hours: e.target.value })} className="h-9" />
            <Input type="number" step="0.01" min="0" placeholder="Expense $" value={bulk.expense} onChange={(e: any) => setBulk({ ...bulk, expense: e.target.value })} className="h-9" />
          </div>
          <p className="text-[11px] text-muted-foreground">Empty fields are ignored. Only filled fields overwrite the selected rows.</p>
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="border border-border rounded-lg overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-orange-500 text-white text-[11px] uppercase tracking-wider">
            <tr>
              {bulkCol && (
                <th className="w-9 px-2 text-center">
                  <input type="checkbox" aria-label="Select all" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={toggleAll} />
                </th>
              )}
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
              <tr><td colSpan={bulkCol ? 10 : 9} className="px-3 py-8 text-center text-muted-foreground italic">No entries yet. Click below to add one.</td></tr>
            )}
            {visible.map((e: any, i: number) => (
              <EntryRow key={e.id} entry={e} stripe={i % 2 === 1} locked={isLocked} myHourlyCents={myHourlyCents} status={saveStatus[e.id]} onChange={(p) => saveCell(e.id, p)} onDelete={() => removeEntry.mutate(e.id)} onDuplicate={() => duplicateEntry.mutate(e)} selectable={bulkCol} selected={selected.has(e.id)} onToggleSelect={() => toggleOne(e.id)} />
            ))}
          </tbody>
        </table>
        {!isLocked && (
          <div className="border-t border-border p-2">
            <button onClick={() => addEntry.mutate()} className="w-full text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded py-2 flex items-center justify-center gap-1.5 transition">
              <Plus size={14} /> Add deliverable
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
              <Button size="icon" variant="outline" className="h-9 w-9 border-orange-500/40 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-300" onClick={() => onEditDraft(s)} aria-label="Admin edit"><Pencil size={14} /></Button>
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: s.id, status: "draft" })}><X size={14} /> Send back</Button>
              <Button size="sm" onClick={() => setStatus.mutate({ id: s.id, status: "approved" })}><Check size={14} /> Approve</Button>
            </>} />
        ))}
      </Section>
      <Section title="Approved" count={approved.length}>
        {approved.length === 0 ? <Empty>None yet.</Empty> : approved.map((s: any) => (
          <SheetRow key={s.id} sheet={s}
            actions={<>
              <Button size="icon" variant="outline" className="h-9 w-9 border-orange-500/40 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-300" onClick={() => onEditDraft(s)} aria-label="Admin edit"><Pencil size={14} /></Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: s.id, status: "draft" })}>Reopen</Button>
            </>} />
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

function SaveDot({ status }: { status?: "saving" | "saved" | "error" }) {
  if (!status) {
    return <span className="w-3.5 h-3.5 inline-flex shrink-0" aria-hidden />;
  }
  if (status === "saving") {
    return (
      <span title="Saving…" className="text-muted-foreground inline-flex shrink-0">
        <Loader2 size={12} className="animate-spin" />
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span title="Saved" className="text-emerald-600 dark:text-emerald-400 inline-flex shrink-0">
        <Check size={12} />
      </span>
    );
  }
  return (
    <span title="Couldn't reach the server — retrying. Your input is safe." className="text-amber-600 dark:text-amber-400 inline-flex shrink-0">
      <AlertCircle size={12} />
    </span>
  );
}

function AutosaveBadge({ status }: { status: Record<string, "saving" | "saved" | "error" | undefined> }) {
  const vals = Object.values(status);
  const saving = vals.some((s) => s === "saving");
  const error  = vals.some((s) => s === "error");
  const recent = vals.some((s) => s === "saved");
  const tone =
    error ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : saving ? "bg-muted text-muted-foreground border-border"
    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  const label =
    error ? "Retrying…"
    : saving ? "Saving…"
    : recent ? "Saved"
    : "Auto-save on";
  return (
    <span className={cn("text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border font-semibold inline-flex items-center gap-1.5", tone)}
      title="Everything you type is saved automatically. No need to click anything.">
      {saving ? <Loader2 size={11} className="animate-spin" /> : error ? <AlertCircle size={11} /> : <Check size={11} />}
      {label}
    </span>
  );
}

/* ---------- entry row ---------- */

function EntryRow({ entry, stripe, locked, myHourlyCents, status, onChange, onDelete, onDuplicate, selectable, selected, onToggleSelect }: { entry: any; stripe: boolean; locked: boolean; myHourlyCents: number; status?: "saving" | "saved" | "error"; onChange: (p: any) => void; onDelete: () => void; onDuplicate?: () => void; selectable?: boolean; selected?: boolean; onToggleSelect?: () => void }) {
  const [local, setLocal] = useState({
    deliverable: entry.deliverable ?? "",
    work_type: entry.work_type ?? "standard",
    start_time: entry.start_time ? toLocalDT(entry.start_time) : "",
    end_time: entry.end_time ? toLocalDT(entry.end_time) : "",
    rate: ((entry.rate_amount_cents ?? 0) / 100).toString(),
    hours: (Number(entry.hours) || 0).toString(),
    expense: ((entry.expense_cents ?? 0) / 100).toString(),
  });

  type LocalState = typeof local;
  // Snapshot the row state from BEFORE the most recent edit so we can revert it.
  // We keep a stack so the user can step back through a few quick edits.
  const [undoStack, setUndoStack] = useState<LocalState[]>([]);

  // Build a full DB patch from a local snapshot so undo writes a consistent set of fields.
  const localToDb = (l: LocalState) => ({
    deliverable: l.deliverable,
    work_type: l.work_type,
    rate_amount_cents:
      l.work_type === "specialist" ? SPECIALIST_RATE_CENTS
      : l.work_type === "reimbursement" ? 0
      : toCents(l.rate || "0"),
    start_time: l.start_time ? new Date(l.start_time).toISOString() : null,
    end_time:   l.end_time   ? new Date(l.end_time).toISOString()   : null,
    day:        l.start_time ? l.start_time.slice(0, 10) : null,
    hours:      parseFloat(l.hours) || 0,
    expense_cents: toCents(l.expense || "0"),
  });

  // Record an undo point before any user edit. Keeps the last 20 steps.
  const pushUndo = () => {
    if (locked) return;
    setUndoStack((s) => [...s.slice(-19), local]);
  };

  const handleUndo = () => {
    if (locked || undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setLocal(prev);
    onChange(localToDb(prev));
  };

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
    pushUndo();
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
    <tr className={cn("hover:bg-accent/20", stripe && "bg-muted/20", selectable && selected && "bg-orange-500/10")}>
      {selectable && (
        <td className="px-2 py-1 text-center">
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect} aria-label="Select row" />
        </td>
      )}
      <td className="px-2 py-1">
        <div className="flex items-center gap-1.5">
          <SaveDot status={status} />
          <input disabled={locked} value={local.deliverable}
            onChange={(e) => { pushUndo(); setLocal({ ...local, deliverable: e.target.value }); commit({ deliverable: e.target.value }); }}
            placeholder="What did you do?" className={cell} />
        </div>
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
          onChange={(e) => { pushUndo(); setLocal({ ...local, rate: e.target.value }); commit({ rate_amount_cents: toCents(e.target.value || "0") }); }}
          className={cn(cellNum, "max-w-[90px]", isSpecialist && "font-semibold opacity-90")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked || isReimburse} type="datetime-local" value={local.start_time}
          onChange={(e) => { pushUndo(); setLocal({ ...local, start_time: e.target.value }); recalcHours(e.target.value, local.end_time); }}
          className={cn(cell, "min-w-[170px]")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked || isReimburse} type="datetime-local" value={local.end_time}
          onChange={(e) => { pushUndo(); setLocal({ ...local, end_time: e.target.value }); recalcHours(local.start_time, e.target.value); }}
          className={cn(cell, "min-w-[170px]")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked || isReimburse} type="number" step="0.25" min="0"
          value={isReimburse ? "" : local.hours}
          placeholder={isReimburse ? "—" : "0.00"}
          onChange={(e) => { pushUndo(); setLocal({ ...local, hours: e.target.value }); commit({ hours: parseFloat(e.target.value) || 0 }); }}
          className={cn(cellNum, "max-w-[70px]")} />
      </td>
      <td className="px-2 py-1">
        <input disabled={locked} type="number" step="0.01" min="0"
          value={local.expense}
          onChange={(e) => { pushUndo(); setLocal({ ...local, expense: e.target.value }); commit({ expense_cents: toCents(e.target.value || "0") }); }}
          className={cn(cellNum, "max-w-[90px]")} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCents(lineTotal)}</td>
      <td className="px-2 py-1 text-right">
        {!locked && (
          <div className="inline-flex items-center gap-0.5">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title={undoStack.length === 0 ? "Nothing to undo" : "Undo last edit on this row"}
              className="text-muted-foreground hover:text-foreground p-1 disabled:opacity-30 disabled:hover:text-muted-foreground"
            >
              <Undo2 size={14} />
            </button>
            {onDuplicate && (
              <button onClick={onDuplicate} title="Duplicate row" className="text-muted-foreground hover:text-foreground p-1"><Copy size={14} /></button>
            )}
            <button onClick={onDelete} title="Delete row" className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={14} /></button>
          </div>
        )}
      </td>
    </tr>
  );
}
