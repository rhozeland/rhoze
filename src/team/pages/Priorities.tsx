import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Check } from "lucide-react";
import { useAuth } from "../lib/auth";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  owner_id: string;
  title: string;
  notes: string | null;
  urgent: boolean;
  important: boolean;
  done: boolean;
  due_date: string | null;
};

const QUADRANTS = [
  { key: "do", label: "Do", subtitle: "Urgent + Important", urgent: true, important: true, tone: "border-red-500/40 bg-red-500/5" },
  { key: "schedule", label: "Schedule", subtitle: "Important, Not Urgent", urgent: false, important: true, tone: "border-blue-500/40 bg-blue-500/5" },
  { key: "delegate", label: "Delegate", subtitle: "Urgent, Not Important", urgent: true, important: false, tone: "border-amber-500/40 bg-amber-500/5" },
  { key: "delete", label: "Delete", subtitle: "Neither", urgent: false, important: false, tone: "border-muted bg-muted/20" },
] as const;

export default function Priorities() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", urgent: false, important: true, due_date: "" });

  const { data: tasks } = useQuery({
    queryKey: ["tasks", scope, user?.id],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (scope === "mine" && user?.id) q = q.eq("owner_id", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name");
      return new Map((data ?? []).map((p) => [p.id, p.display_name]));
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("tasks").insert({
        owner_id: user!.id,
        title: form.title.trim(),
        notes: form.notes.trim() || null,
        urgent: form.urgent,
        important: form.important,
        due_date: form.due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Task added" });
      setOpen(false);
      setForm({ title: "", notes: "", urgent: false, important: true, due_date: "" });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const visible = (tasks ?? []).filter((t) => !t.done);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Priorities</h1>
          <p className="text-sm text-muted-foreground">Eisenhower matrix — focus on what matters.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button
              onClick={() => setScope("mine")}
              className={cn("px-3 py-1.5 rounded-sm transition", scope === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Mine
            </button>
            <button
              onClick={() => setScope("team")}
              className={cn("px-3 py-1.5 rounded-sm transition", scope === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Team
            </button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus size={14} /> New task</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.important} onCheckedChange={(v) => setForm({ ...form, important: !!v })} /> Important</label>
                  <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.urgent} onCheckedChange={(v) => setForm({ ...form, urgent: !!v })} /> Urgent</label>
                </div>
                <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={create.isPending}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANTS.map((q) => {
          const items = visible.filter((t) => t.urgent === q.urgent && t.important === q.important);
          return (
            <div key={q.key} className={cn("border rounded-lg p-4 min-h-[220px]", q.tone)}>
              <div className="flex items-baseline justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-wider">{q.label}</div>
                  <div className="text-xs text-muted-foreground">{q.subtitle}</div>
                </div>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && <div className="text-xs text-muted-foreground italic">Nothing here.</div>}
                {items.map((t) => {
                  const ownerName = profiles?.get(t.owner_id) ?? "—";
                  const isOwn = t.owner_id === user?.id;
                  return (
                    <div key={t.id} className="bg-card border border-border rounded-md p-3 text-sm group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{t.title}</div>
                          {t.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.notes}</div>}
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                            {t.due_date && <span>Due {new Date(t.due_date).toLocaleDateString()}</span>}
                            {scope === "team" && <span>· {ownerName}</span>}
                          </div>
                        </div>
                        {isOwn && (
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button title="Mark done" onClick={() => update.mutate({ id: t.id, patch: { done: true } })} className="text-green-500 hover:text-green-400"><Check size={14} /></button>
                            <button title="Delete" onClick={() => remove.mutate(t.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
