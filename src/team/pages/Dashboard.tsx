import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Plus, Check, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
  { key: "do", label: "Do", subtitle: "Urgent + Important", urgent: true, important: true, tone: "border-red-500/40 bg-red-500/[0.03]" },
  { key: "schedule", label: "Schedule", subtitle: "Important · Not Urgent", urgent: false, important: true, tone: "border-blue-500/40 bg-blue-500/[0.03]" },
  { key: "delegate", label: "Delegate", subtitle: "Urgent · Not Important", urgent: true, important: false, tone: "border-amber-500/40 bg-amber-500/[0.03]" },
  { key: "delete", label: "Delete", subtitle: "Neither — drop or backlog", urgent: false, important: false, tone: "border-muted bg-muted/10" },
] as const;

export default function Dashboard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [dragId, setDragId] = useState<string | null>(null);
  const name = user?.email?.split("@")[0] ?? "team";

  const { data: tasks } = useQuery({
    queryKey: ["tasks", scope, user?.id],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").eq("done", false).order("created_at", { ascending: false });
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

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Task> }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const create = useMutation({
    mutationFn: async ({ title, urgent, important }: { title: string; urgent: boolean; important: boolean }) => {
      if (!title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("tasks").insert({
        owner_id: user!.id,
        title: title.trim(),
        urgent,
        important,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: any) => toast({ title: "Couldn't add", description: e.message, variant: "destructive" }),
  });

  const counts = useMemo(() => {
    const c = { do: 0, schedule: 0, delegate: 0, delete: 0, total: 0 };
    (tasks ?? []).forEach((t) => {
      c.total++;
      if (t.urgent && t.important) c.do++;
      else if (!t.urgent && t.important) c.schedule++;
      else if (t.urgent && !t.important) c.delegate++;
      else c.delete++;
    });
    return c;
  }, [tasks]);

  const handleDrop = (urgent: boolean, important: boolean) => {
    if (!dragId) return;
    const task = (tasks ?? []).find((t) => t.id === dragId);
    if (!task) return;
    if (task.urgent === urgent && task.important === important) return;
    update.mutate({ id: dragId, patch: { urgent, important } });
    setDragId(null);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Welcome, {name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Today's responsibilities — drag tasks between quadrants, edit inline.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button onClick={() => setScope("mine")} className={cn("px-3 py-1.5 rounded-sm transition", scope === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Mine</button>
            <button onClick={() => setScope("team")} className={cn("px-3 py-1.5 rounded-sm transition", scope === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Team</button>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">{counts.total} open</div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {QUADRANTS.map((q) => (
          <Quadrant
            key={q.key}
            quadrant={q}
            tasks={(tasks ?? []).filter((t) => t.urgent === q.urgent && t.important === q.important)}
            scope={scope}
            currentUserId={user?.id}
            profiles={profiles}
            dragId={dragId}
            setDragId={setDragId}
            onDrop={handleDrop}
            onUpdate={(id, patch) => update.mutate({ id, patch })}
            onDelete={(id) => remove.mutate(id)}
            onCreate={(title) => create.mutate({ title, urgent: q.urgent, important: q.important })}
          />
        ))}
      </div>
    </div>
  );
}

function Quadrant({
  quadrant, tasks, scope, currentUserId, profiles, dragId, setDragId, onDrop, onUpdate, onDelete, onCreate,
}: {
  quadrant: typeof QUADRANTS[number];
  tasks: Task[];
  scope: "mine" | "team";
  currentUserId?: string;
  profiles?: Map<string, string | null>;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: (urgent: boolean, important: boolean) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const [over, setOver] = useState(false);
  const [adding, setAdding] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(quadrant.urgent, quadrant.important); }}
      className={cn(
        "border rounded-lg p-4 min-h-[260px] transition-colors",
        quadrant.tone,
        over && "ring-2 ring-primary/50 bg-primary/5",
      )}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider">{quadrant.label}</div>
          <div className="text-xs text-muted-foreground">{quadrant.subtitle}</div>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && <div className="text-xs text-muted-foreground italic px-1">Drop a task here, or add below.</div>}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            isOwn={t.owner_id === currentUserId}
            ownerName={scope === "team" ? profiles?.get(t.owner_id) ?? "—" : null}
            onDragStart={() => setDragId(t.id)}
            onDragEnd={() => setDragId(null)}
            onUpdate={(patch) => onUpdate(t.id, patch)}
            onDelete={() => onDelete(t.id)}
          />
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!adding.trim()) return;
            onCreate(adding);
            setAdding("");
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex items-center gap-1.5 mt-2"
        >
          <Plus size={14} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 bg-transparent text-sm py-1.5 px-1 outline-none placeholder:text-muted-foreground/60 focus:bg-card/60 rounded"
          />
        </form>
      </div>
    </div>
  );
}

function TaskCard({ task, isOwn, ownerName, onDragStart, onDragEnd, onUpdate, onDelete }: {
  task: Task;
  isOwn: boolean;
  ownerName: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onUpdate: (patch: Partial<Task>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const save = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== task.title) onUpdate({ title: draft.trim() });
    else setDraft(task.title);
  };

  return (
    <div
      draggable={isOwn}
      onDragStart={(e) => { if (!isOwn) { e.preventDefault(); return; } onDragStart(); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-card border border-border rounded-md p-2.5 text-sm group",
        isOwn ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-90",
      )}
    >
      <div className="flex items-start gap-2">
        {isOwn && <GripVertical size={14} className="text-muted-foreground/40 mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(task.title); setEditing(false); } }}
              className="w-full bg-transparent border-b border-primary/40 outline-none text-sm font-medium py-0.5"
            />
          ) : (
            <div
              onClick={() => isOwn && setEditing(true)}
              className={cn("font-medium truncate", isOwn && "cursor-text hover:text-primary")}
              title={isOwn ? "Click to rename" : task.title}
            >
              {task.title}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            {task.due_date && <span>Due {new Date(task.due_date).toLocaleDateString()}</span>}
            {ownerName && <span>· {ownerName}</span>}
          </div>
        </div>
        {isOwn && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button title="Mark done" onClick={() => onUpdate({ done: true })} className="text-emerald-500 hover:text-emerald-400 p-0.5"><Check size={14} /></button>
            <button title="Delete" onClick={onDelete} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
