import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronUp, ChevronDown, CheckCircle2, Circle, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "../lib/format";

type Status = "pending" | "submitted" | "approved" | "cancelled";

interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  status: Status;
  credit_cost: number;
  due_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
}

/**
 * Roadmap component shared by the client portal (read-only-ish) and the
 * admin ProjectDetail page (full edit). Mirrors the Creator OS milestone
 * model: pending → submitted → approved.
 */
export default function ProjectMilestones({
  projectId,
  canEdit,
  canApprove,
  canSubmit = false,
}: {
  projectId: string;
  canEdit: boolean;
  canApprove: boolean;
  /** Allow non-editors (clients) to flip pending → submitted (request review). */
  canSubmit?: boolean;
}) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", credit_cost: "0", due_date: "" });

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ["project_milestones", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project_milestones", projectId] });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const nextSort = (milestones[milestones.length - 1]?.sort_order ?? 0) + 10;
      const { error } = await supabase.from("project_milestones").insert({
        project_id: projectId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        credit_cost: Math.max(0, parseInt(form.credit_cost || "0", 10)),
        due_date: form.due_date || null,
        sort_order: nextSort,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ title: "", description: "", credit_cost: "0", due_date: "" });
      setShowAdd(false);
      invalidate();
    },
    onError: (e: any) => toast({ title: "Could not add milestone", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: Status }) => {
      const now = new Date().toISOString();
      const patch =
        next === "submitted" ? { status: next, submitted_at: now }
        : next === "approved" ? { status: next, approved_at: now }
        : next === "pending" ? { status: next, submitted_at: null, approved_at: null }
        : { status: next };
      const { error } = await supabase.from("project_milestones").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: "up" | "down" }) => {
      const idx = milestones.findIndex((m) => m.id === id);
      const swapWith = dir === "up" ? milestones[idx - 1] : milestones[idx + 1];
      if (!swapWith) return;
      const a = milestones[idx];
      await Promise.all([
        supabase.from("project_milestones").update({ sort_order: swapWith.sort_order }).eq("id", a.id),
        supabase.from("project_milestones").update({ sort_order: a.sort_order }).eq("id", swapWith.id),
      ]);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_milestones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const onAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate();
  };

  const total = milestones.length;
  const done = milestones.filter((m) => m.status === "approved").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Roadmap · <span className="font-medium text-foreground">{done}/{total}</span> approved
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setShowAdd((s) => !s)}>
            <Plus size={14} className="mr-1" /> Add milestone
          </Button>
        )}
      </div>

      {canEdit && showAdd && (
        <form onSubmit={onAddSubmit} className="rounded-lg border border-border bg-card p-3 space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mix v1 delivered" />
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Credit cost</Label>
              <Input type="number" min="0" value={form.credit_cost} onChange={(e) => setForm({ ...form, credit_cost: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={add.isPending}>Add</Button>
          </div>
        </form>
      )}

      <ol className="rounded-lg border border-border bg-card divide-y divide-border">
        {isLoading && <li className="p-4 text-sm text-muted-foreground">Loading roadmap…</li>}
        {!isLoading && milestones.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">
            No milestones yet.{canEdit ? " Add the first one above." : " Your team will publish them here soon."}
          </li>
        )}
        {milestones.map((m, i) => (
          <li key={m.id} className="p-3 flex items-start gap-3">
            <StatusIcon status={m.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`text-sm font-medium ${m.status === "approved" ? "line-through text-muted-foreground" : ""}`}>
                  {m.title}
                </div>
                <StatusPill status={m.status} />
                {m.credit_cost > 0 && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.credit_cost} cr
                  </span>
                )}
              </div>
              {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
              <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                {m.due_date && <span>Due {formatDate(m.due_date)}</span>}
                {m.submitted_at && <span>Submitted {formatDate(m.submitted_at)}</span>}
                {m.approved_at && <span>Approved {formatDate(m.approved_at)}</span>}
              </div>

              {(canEdit || canApprove || canSubmit) && (
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  {(canEdit || canSubmit) && m.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: m.id, next: "submitted" })}>
                      {canEdit ? "Mark submitted" : "Request review"}
                    </Button>
                  )}
                  {canApprove && m.status === "submitted" && (
                    <Button size="sm" onClick={() => updateStatus.mutate({ id: m.id, next: "approved" })}>
                      Approve
                    </Button>
                  )}
                  {!canApprove && !canEdit && m.status === "submitted" && (
                    <span className="text-[11px] text-muted-foreground italic">Awaiting team approval</span>
                  )}
                  {canEdit && m.status === "approved" && (
                    <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: m.id, next: "pending" })}>
                      Reopen
                    </Button>
                  )}
                  {canEdit && (
                    <>
                      <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => reorder.mutate({ id: m.id, dir: "up" })} title="Move up">
                        <ChevronUp size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={i === milestones.length - 1} onClick={() => reorder.mutate({ id: m.id, dir: "down" })} title="Move down">
                        <ChevronDown size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove.mutate(m.id)} title="Delete">
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "approved") return <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />;
  if (status === "submitted") return <Clock size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />;
  if (status === "cancelled") return <Circle size={18} className="text-muted-foreground/50 mt-0.5 shrink-0" />;
  return <Circle size={18} className="text-muted-foreground mt-0.5 shrink-0" />;
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pending: "bg-muted text-muted-foreground border-border",
    submitted: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    cancelled: "bg-muted text-muted-foreground border-border line-through",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${map[status]}`}>
      {status}
    </span>
  );
}