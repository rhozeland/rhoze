import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Plus, Check, Trash2, GripVertical, Search, X, ChevronDown, UserCircle2, ArrowLeft, BellRing } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  assigned_to: string | null;
  assigned_by: string | null;
  acknowledged_at: string | null;
};

const QUADRANTS = [
  { key: "do", label: "Do", subtitle: "Urgent + Important", urgent: true, important: true, tone: "border-red-500/40 bg-red-500/[0.03]" },
  { key: "schedule", label: "Schedule", subtitle: "Important · Not Urgent", urgent: false, important: true, tone: "border-blue-500/40 bg-blue-500/[0.03]" },
  { key: "delegate", label: "Delegate", subtitle: "Urgent · Not Important", urgent: true, important: false, tone: "border-amber-500/40 bg-amber-500/[0.03]" },
  { key: "delete", label: "Delete", subtitle: "Neither — drop or backlog", urgent: false, important: false, tone: "border-muted bg-muted/10" },
] as const;

const DEPARTMENTS = ["marketing", "hr", "development", "sales", "operations"] as const;

const DEPARTMENT_STYLES: Record<string, string> = {
  marketing: "bg-pink-500/15 text-pink-600 dark:text-pink-300 border-pink-500/30",
  hr: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  development: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
  sales: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  operations: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
};

function DepartmentBadge({ department }: { department: string }) {
  const style = DEPARTMENT_STYLES[department] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wide", style)}>
      {department}
    </span>
  );
}

type Profile = { name: string | null; department: string | null; email: string | null };

export default function Dashboard() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { if (scope === "mine") { setFocusedUserId(null); setDeptFilter(new Set()); } }, [scope]);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", scope, focusedUserId, user?.id],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").eq("done", false).order("created_at", { ascending: false });
      if (scope === "mine" && user?.id) {
        q = q.or(`owner_id.eq.${user.id},assigned_to.eq.${user.id}`);
      } else if (scope === "team" && focusedUserId) {
        q = q.or(`owner_id.eq.${focusedUserId},assigned_to.eq.${focusedUserId}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: profilesArr } = useQuery({
    queryKey: ["profiles-team-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, email, department").eq("employment_status", "active");
      return (data ?? []) as Array<{ id: string; display_name: string | null; email: string | null; department: string | null }>;
    },
  });

  const profiles = useMemo(() => {
    return new Map<string, Profile>((profilesArr ?? []).map((p) => [p.id, { name: p.display_name, department: p.department, email: p.email }]));
  }, [profilesArr]);

  const focusedProfile = focusedUserId ? profiles.get(focusedUserId) : null;
  const focusedIsMe = focusedUserId === user?.id;
  const canEditFocused = focusedIsMe || isAdmin;

  const update = useMutation({
    mutationFn: async ({ id, patch, notify }: { id: string; patch: Partial<Task>; notify?: boolean }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
      if (notify) {
        try { await supabase.functions.invoke("notify-task-completed", { body: { taskId: id } }); } catch (e) { console.warn(e); }
      }
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
    mutationFn: async ({ title, urgent, important, ownerId, assign }: { title: string; urgent: boolean; important: boolean; ownerId: string; assign: boolean }) => {
      if (!title.trim()) throw new Error("Title required");
      const row: any = { owner_id: ownerId, title: title.trim(), urgent, important };
      if (assign && user?.id && ownerId !== user.id) {
        row.assigned_to = ownerId;
        row.assigned_by = user.id;
      }
      const { error } = await supabase.from("tasks").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: any) => toast({ title: "Couldn't add", description: e.message, variant: "destructive" }),
  });

  // Filtering
  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      const ownerProf = profiles.get(t.owner_id);
      const dept = ownerProf?.department;
      if (scope === "team" && !focusedUserId && deptFilter.size > 0 && !(dept && deptFilter.has(dept))) return false;
      if (q) {
        const hay = `${t.title ?? ""} ${ownerProf?.name ?? ""} ${dept ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, profiles, deptFilter, search, scope, focusedUserId]);

  const counts = useMemo(() => {
    const c = { do: 0, schedule: 0, delegate: 0, delete: 0, total: 0, assignedToMe: 0, unack: 0 };
    (tasks ?? []).forEach((t) => {
      if (scope === "mine" && t.assigned_to === user?.id && !t.acknowledged_at) c.unack++;
      if (t.assigned_to === user?.id) c.assignedToMe++;
    });
    filteredTasks.forEach((t) => {
      c.total++;
      if (t.urgent && t.important) c.do++;
      else if (!t.urgent && t.important) c.schedule++;
      else if (t.urgent && !t.important) c.delegate++;
      else c.delete++;
    });
    return c;
  }, [filteredTasks, tasks, scope, user?.id]);

  const toggleDept = (d: string) => {
    setDeptFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const handleDrop = (urgent: boolean, important: boolean) => {
    if (!dragId) return;
    const task = (tasks ?? []).find((t) => t.id === dragId);
    if (!task) return;
    if (task.urgent === urgent && task.important === important) return;
    update.mutate({ id: dragId, patch: { urgent, important } });
    setDragId(null);
  };

  // Team unfocused — group tasks by owner department
  const teamGroups = useMemo(() => {
    if (scope !== "team" || focusedUserId) return null;
    const visibleDepts = DEPARTMENTS.filter((d) => deptFilter.size === 0 || deptFilter.has(d));
    return visibleDepts.map((dept) => {
      const people = (profilesArr ?? []).filter((p) => p.department === dept);
      const peopleWithCounts = people.map((p) => ({
        ...p,
        openCount: (tasks ?? []).filter((t) => t.owner_id === p.id || t.assigned_to === p.id).length,
      }));
      return { dept, people: peopleWithCounts };
    });
  }, [scope, focusedUserId, profilesArr, tasks, deptFilter]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div className="min-w-0">
          {scope === "team" && focusedUserId ? (
            <>
              <button onClick={() => setFocusedUserId(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
                <ArrowLeft size={12} /> Back to team board
              </button>
              <h1 className="text-3xl font-semibold flex items-center gap-2">
                {focusedProfile?.name ?? focusedProfile?.email ?? "Teammate"}
                {focusedProfile?.department && <DepartmentBadge department={focusedProfile.department} />}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {canEditFocused
                  ? (focusedIsMe ? "Your priority matrix." : "Drag or add tasks to assign — they'll be notified.")
                  : "Read-only view of this teammate's matrix."}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">{scope === "mine" ? "Your Dashboard" : "Team Board"}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {scope === "mine"
                  ? "Drag tasks between quadrants of your matrix to organize responsibilities."
                  : "Each department's people. Click anyone to view their matrix."}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button onClick={() => setScope("mine")} className={cn("px-3 py-1.5 rounded-sm transition relative", scope === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              Mine
              {counts.unack > 0 && scope !== "mine" && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-bold rounded-full bg-red-500 text-white px-0.5">{counts.unack}</span>
              )}
            </button>
            <button onClick={() => setScope("team")} className={cn("px-3 py-1.5 rounded-sm transition", scope === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Team</button>
          </div>
          {(scope === "mine" || focusedUserId) && (
            <div className="text-xs text-muted-foreground tabular-nums">{counts.total} open</div>
          )}
          <div className="flex items-center">
            {searchOpen ? (
              <div className="flex items-center gap-1 border border-border rounded-md px-2 py-1 bg-card">
                <Search size={12} className="text-muted-foreground shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); setSearchOpen(false); } }}
                  placeholder="Search…"
                  className="bg-transparent text-xs outline-none w-48 placeholder:text-muted-foreground/60"
                />
                <button onClick={() => { setSearch(""); setSearchOpen(false); }} className="text-muted-foreground hover:text-foreground" title="Close">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition" title="Search">
                <Search size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Assigned-to-me banner (Mine view) */}
      {scope === "mine" && counts.assignedToMe > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/[0.05] text-xs">
          <BellRing size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-medium">{counts.assignedToMe} task{counts.assignedToMe === 1 ? "" : "s"} assigned to you by an admin.</span>
            <span className="text-muted-foreground"> Marking them done notifies the admin who assigned it.</span>
          </div>
        </div>
      )}

      {/* Department filter — only Team unfocused */}
      {scope === "team" && !focusedUserId && (
        <>
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Departments</span>
            {DEPARTMENTS.map((d) => {
              const active = deptFilter.has(d);
              const style = DEPARTMENT_STYLES[d];
              return (
                <button key={d} onClick={() => toggleDept(d)} className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide transition",
                  active ? style : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}>{d}</button>
              );
            })}
            {deptFilter.size > 0 && (
              <button onClick={() => setDeptFilter(new Set())} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">Clear</button>
            )}
          </div>
          <div className="sm:hidden">
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border text-xs text-foreground hover:border-foreground/30 transition">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Departments</span>
                    {deptFilter.size === 0 ? <span className="text-muted-foreground">All</span> : (
                      <span className="flex items-center gap-1 flex-wrap">
                        {Array.from(deptFilter).map((d) => (
                          <span key={d} className={cn("px-1.5 py-0.5 rounded border text-[9px] uppercase font-medium", DEPARTMENT_STYLES[d])}>{d}</span>
                        ))}
                      </span>
                    )}
                  </span>
                  <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-1.5">
                <div className="space-y-0.5">
                  {DEPARTMENTS.map((d) => {
                    const active = deptFilter.has(d);
                    return (
                      <button key={d} onClick={() => toggleDept(d)} className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/60 transition text-left">
                        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide", DEPARTMENT_STYLES[d])}>{d}</span>
                        {active && <Check size={14} className="text-primary shrink-0" />}
                      </button>
                    );
                  })}
                  {deptFilter.size > 0 && (
                    <button onClick={() => setDeptFilter(new Set())} className="w-full text-left px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground border-t border-border mt-1 pt-2">Clear all</button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      {/* TEAM unfocused: people-by-department board */}
      {scope === "team" && !focusedUserId && teamGroups && (
        <div className="space-y-6">
          {teamGroups.every((g) => g.people.length === 0) && (
            <div className="text-sm text-muted-foreground italic px-1">No teammates match this filter.</div>
          )}
          {teamGroups.map((g) => (
            g.people.length === 0 ? null : (
              <section key={g.dept}>
                <div className="flex items-center gap-2 mb-2">
                  <DepartmentBadge department={g.dept} />
                  <span className="text-xs text-muted-foreground">{g.people.length} {g.people.length === 1 ? "person" : "people"}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {g.people.map((p) => (
                    <button key={p.id} onClick={() => setFocusedUserId(p.id)} className="flex items-center gap-3 p-3 rounded-md border border-border bg-card hover:border-foreground/30 hover:bg-muted/40 transition text-left">
                      <UserCircle2 size={20} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.display_name ?? p.email ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">{p.openCount} open</div>
                      </div>
                      {!isAdmin && p.id !== user?.id && <span className="text-[9px] uppercase text-muted-foreground">view</span>}
                    </button>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>
      )}

      {/* Matrix view — Mine OR Team focused */}
      {(scope === "mine" || focusedUserId) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {QUADRANTS.map((q) => {
            const targetOwnerId = scope === "mine" ? user?.id : focusedUserId;
            const canEdit = scope === "mine" ? true : canEditFocused;
            return (
              <Quadrant
                key={q.key}
                quadrant={q}
                tasks={filteredTasks.filter((t) => t.urgent === q.urgent && t.important === q.important)}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                canEdit={canEdit}
                profiles={profiles}
                dragId={dragId}
                setDragId={setDragId}
                onDrop={handleDrop}
                onUpdate={(id, patch, opts) => update.mutate({ id, patch, notify: opts?.notify })}
                onDelete={(id) => remove.mutate(id)}
                onCreate={(title) => {
                  if (!targetOwnerId) return;
                  const assign = scope === "team" && !focusedIsMe;
                  create.mutate({ title, urgent: q.urgent, important: q.important, ownerId: targetOwnerId, assign });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Quadrant({
  quadrant, tasks, currentUserId, isAdmin, canEdit, profiles, dragId, setDragId, onDrop, onUpdate, onDelete, onCreate,
}: {
  quadrant: typeof QUADRANTS[number];
  tasks: Task[];
  currentUserId?: string;
  isAdmin: boolean;
  canEdit: boolean;
  profiles: Map<string, Profile>;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onDrop: (urgent: boolean, important: boolean) => void;
  onUpdate: (id: string, patch: Partial<Task>, opts?: { notify?: boolean }) => void;
  onDelete: (id: string) => void;
  onCreate: (title: string) => void;
}) {
  const [over, setOver] = useState(false);
  const [adding, setAdding] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { if (canEdit) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); if (canEdit) onDrop(quadrant.urgent, quadrant.important); }}
      className={cn("border rounded-lg p-4 min-h-[260px] transition-colors", quadrant.tone, over && "ring-2 ring-primary/50 bg-primary/5")}
    >
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wider">{quadrant.label}</div>
          <div className="text-xs text-muted-foreground">{quadrant.subtitle}</div>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="text-xs text-muted-foreground italic px-1">{canEdit ? "Drop a task here, or add below." : "No tasks."}</div>
        )}
        {tasks.map((t) => {
          const isOwn = t.owner_id === currentUserId || t.assigned_to === currentUserId;
          const draggable = canEdit && (isOwn || isAdmin);
          const assignerName = t.assigned_by ? (profiles.get(t.assigned_by)?.name ?? null) : null;
          const ownerName = t.owner_id !== currentUserId ? (profiles.get(t.owner_id)?.name ?? null) : null;
          return (
            <TaskCard
              key={t.id}
              task={t}
              draggable={draggable}
              canEdit={canEdit && (isOwn || isAdmin)}
              isAssigneeMe={t.assigned_to === currentUserId}
              assignerName={assignerName}
              ownerName={ownerName}
              ownerDepartment={profiles.get(t.owner_id)?.department ?? null}
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
              onUpdate={(patch, opts) => onUpdate(t.id, patch, opts)}
              onDelete={() => onDelete(t.id)}
            />
          );
        })}

        {canEdit && (
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
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, draggable, canEdit, isAssigneeMe, assignerName, ownerName, ownerDepartment, onDragStart, onDragEnd, onUpdate, onDelete }: {
  task: Task;
  draggable: boolean;
  canEdit: boolean;
  isAssigneeMe: boolean;
  assignerName: string | null;
  ownerName: string | null;
  ownerDepartment: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onUpdate: (patch: Partial<Task>, opts?: { notify?: boolean }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  const save = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== task.title) onUpdate({ title: draft.trim() });
    else setDraft(task.title);
  };

  const isAssigned = !!task.assigned_by;
  const needsAck = isAssigneeMe && isAssigned && !task.acknowledged_at;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { if (!draggable) { e.preventDefault(); return; } onDragStart(); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={onDragEnd}
      onClick={() => { if (needsAck) onUpdate({ acknowledged_at: new Date().toISOString() }); }}
      className={cn(
        "bg-card border rounded-md p-2.5 text-sm group",
        needsAck ? "border-amber-500/60 shadow-[0_0_0_1px_hsl(var(--ring)/0.1)]" : "border-border",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-95",
      )}
    >
      <div className="flex items-start gap-2">
        {draggable && <GripVertical size={14} className="text-muted-foreground/40 mt-0.5 shrink-0" />}
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
              onClick={(e) => { if (canEdit) { e.stopPropagation(); setEditing(true); } }}
              className={cn("font-medium truncate", canEdit && "cursor-text hover:text-primary")}
              title={task.title}
            >
              {task.title}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
            {task.due_date && <span>Due {new Date(task.due_date).toLocaleDateString()}</span>}
            {ownerName && <span>· {ownerName}</span>}
            {ownerDepartment && <DepartmentBadge department={ownerDepartment} />}
            {isAssigned && (
              <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wide",
                needsAck ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40" : "bg-muted text-muted-foreground border-border"
              )}>
                {needsAck ? "New · tap to ack" : `Assigned${assignerName ? ` by ${assignerName}` : ""}`}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button title="Mark done" onClick={(e) => { e.stopPropagation(); onUpdate({ done: true }, { notify: isAssigned }); }} className="text-emerald-500 hover:text-emerald-400 p-0.5"><Check size={14} /></button>
            <button title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}
