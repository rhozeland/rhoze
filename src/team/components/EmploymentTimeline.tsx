import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

type Dept = "marketing" | "hr" | "development" | "sales" | "operations";
const DEPTS: { value: Dept; label: string }[] = [
  { value: "marketing", label: "Marketing" },
  { value: "hr", label: "HR" },
  { value: "development", label: "Development" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
];
const STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "contractor", label: "Contractor" },
  { value: "intern", label: "Intern" },
  { value: "former", label: "Former" },
];

export default function EmploymentTimeline({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({
    status: "active",
    job_title: "",
    department: "" as "" | Dept,
    started_at: "",
    ended_at: "",
    notes: "",
  });

  const { data: history, isLoading } = useQuery({
    queryKey: ["emp-history", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_employment_history")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profile_employment_history").insert({
        user_id: userId,
        status: draft.status,
        job_title: draft.job_title || null,
        department: (draft.department || null) as Dept | null,
        started_at: draft.started_at || null,
        ended_at: draft.ended_at || null,
        notes: draft.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Entry added" });
      setDraft({ status: "active", job_title: "", department: "", started_at: "", ended_at: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["emp-history", userId] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profile_employment_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emp-history", userId] }),
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="bg-muted/20 px-4 py-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment timeline</div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (history ?? []).length === 0 ? (
        <div className="text-xs text-muted-foreground">No history entries yet.</div>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-3">
          {(history ?? []).map((h: any) => (
            <li key={h.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-foreground" />
              <div className="flex items-start justify-between gap-3 bg-card border border-border rounded p-3">
                <div className="text-sm space-y-0.5">
                  <div className="font-medium">
                    {h.job_title || "—"}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {STATUSES.find((s) => s.value === h.status)?.label ?? h.status}
                      {h.department && ` · ${DEPTS.find((d) => d.value === h.department)?.label ?? h.department}`}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {h.started_at ?? "?"} → {h.ended_at ?? "present"}
                  </div>
                  {h.notes && <div className="text-xs mt-1 whitespace-pre-wrap">{h.notes}</div>}
                </div>
                <button
                  onClick={() => remove.mutate(h.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title="Delete entry"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="border border-dashed border-border rounded p-3 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <div className="md:col-span-1">
          <label className="text-[10px] uppercase text-muted-foreground">Status</label>
          <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="md:col-span-1">
          <label className="text-[10px] uppercase text-muted-foreground">Department</label>
          <Select value={draft.department || "__none"} onValueChange={(v) => setDraft({ ...draft, department: v === "__none" ? "" : (v as Dept) })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {DEPTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-1">
          <label className="text-[10px] uppercase text-muted-foreground">Job title</label>
          <Input className="h-9" value={draft.job_title} onChange={(e) => setDraft({ ...draft, job_title: e.target.value })} placeholder="e.g. Lead Designer" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Started</label>
          <Input type="date" className="h-9" value={draft.started_at} onChange={(e) => setDraft({ ...draft, started_at: e.target.value })} />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Ended</label>
          <Input type="date" className="h-9" value={draft.ended_at} onChange={(e) => setDraft({ ...draft, ended_at: e.target.value })} />
        </div>
        <Button size="sm" className="h-9" onClick={() => add.mutate()}>
          <Plus size={14} className="mr-1" /> Add entry
        </Button>
        <div className="md:col-span-6">
          <label className="text-[10px] uppercase text-muted-foreground">Notes</label>
          <Input className="h-9" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="e.g. promoted from Junior, returned from leave" />
        </div>
      </div>
    </div>
  );
}