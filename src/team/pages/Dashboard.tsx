import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";
import { Plus, Check, Trash2, GripVertical, Search, X, ChevronDown, UserCircle2, ArrowLeft, BellRing, Calendar, FileText, Users, User, Shield } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  scope: "personal" | "team";
  department: string | null;
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
type Tab = "mine" | "team" | "manage";

export default function Dashboard() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const [teamDept, setTeamDept] = useState<string | null>(null); // selected dept for Team tab
  const [focusedUserId, setFocusedUserId] = useState<string | null>(null); // Manage tab drill-in
  const [manageDeptFilter, setManageDeptFilter] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { setFocusedUserId(null); setSearch(""); }, [tab]);

  // Profiles
  const { data: profilesArr } = useQuery({
    queryKey: ["profiles-team-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, email, department").eq("employment_status", "active");
      return (data ?? []) as Array<{ id: string; display_name: string | null; email: string | null; department: string | null }>;
    },
  });
  const profiles = useMemo(() => new Map<string, Profile>((profilesArr ?? []).map((p) => [p.id, { name: p.display_name, department: p.department, email: p.email }])), [profilesArr]);
  const myProfile = user?.id ? profiles.get(user.id) : null;
  const myDepartment = myProfile?.department ?? null;

  // Default Team dept = my dept
  useEffect(() => {
    if (tab === "team" && !teamDept && myDepartment) setTeamDept(myDepartment);
  }, [tab, teamDept, myDepartment]);

  // Tasks query: depends on tab
  const { data: tasks } = useQuery({
    queryKey: ["tasks", tab, teamDept, focusedUserId, user?.id],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*").eq("done", false).order("created_at", { ascending: false });
      if (tab === "mine" && user?.id) {
        q = q.eq("scope", "personal").or(`owner_id.eq.${user.id},assigned_to.eq.${user.id}`);
      } else if (tab === "team" && teamDept) {
        q = q.eq("scope", "team").eq("department", teamDept);
      } else if (tab === "manage") {
        q = q.eq("scope", "personal");
        if (focusedUserId) q = q.or(`owner_id.eq.${focusedUserId},assigned_to.eq.${focusedUserId}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user?.id && (tab !== "team" || !!teamDept),
  });

  // Inbox banner — assigned to me, unack
  const { data: assignedToMe } = useQuery({
    queryKey: ["tasks-assigned-to-me", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase.from("tasks").select("id, acknowledged_at").eq("done", false).eq("assigned_to", user.id);
      return data ?? [];
    },
    enabled: !!user?.id,
  });
  const unackCount = (assignedToMe ?? []).filter((t: any) => !t.acknowledged_at).length;
  const assignedCount = (assignedToMe ?? []).length;

  const detailTask = useMemo(() => (tasks ?? []).find((t) => t.id === detailTaskId) ?? null, [tasks, detailTaskId]);

  const update = useMutation({
    mutationFn: async ({ id, patch, notify }: { id: string; patch: Partial<Task>; notify?: boolean }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
      if (notify) {
        try { await supabase.functions.invoke("notify-task-completed", { body: { taskId: id } }); } catch (e) { console.warn(e); }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tasks-assigned-to-me"] }); },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setDetailTaskId(null); },
  });

  const create = useMutation({
    mutationFn: async (input: { title: string; urgent: boolean; important: boolean }) => {
      if (!input.title.trim() || !user?.id) throw new Error("Title required");
      const row: any = { title: input.title.trim(), urgent: input.urgent, important: input.important };
      if (tab === "team" && teamDept) {
        row.scope = "team";
        row.department = teamDept;
        row.owner_id = user.id;
      } else if (tab === "manage" && focusedUserId) {
        row.scope = "personal";
        row.owner_id = focusedUserId;
        if (focusedUserId !== user.id) {
          row.assigned_to = focusedUserId;
          row.assigned_by = user.id;
        }
      } else {
        row.scope = "personal";
        row.owner_id = user.id;
      }
      const { error } = await supabase.from("tasks").insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: any) => toast({ title: "Couldn't add", description: e.message, variant: "destructive" }),
  });

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks ?? [];
    return (tasks ?? []).filter((t) => {
      const owner = profiles.get(t.owner_id);
      const hay = `${t.title ?? ""} ${owner?.name ?? ""} ${t.notes ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, search, profiles]);

  const counts = useMemo(() => {
    const c = { do: 0, schedule: 0, delegate: 0, delete: 0, total: 0 };
    filteredTasks.forEach((t) => {
      c.total++;
      if (t.urgent && t.important) c.do++;
      else if (!t.urgent && t.important) c.schedule++;
      else if (t.urgent && !t.important) c.delegate++;
      else c.delete++;
    });
    return c;
  }, [filteredTasks]);

  const handleDrop = (urgent: boolean, important: boolean) => {
    if (!dragId) return;
    const task = (tasks ?? []).find((t) => t.id === dragId);
    if (!task) return;
    if (task.urgent === urgent && task.important === important) return;
    update.mutate({ id: dragId, patch: { urgent, important } });
    setDragId(null);
  };

  // Manage roster
  const manageRoster = useMemo(() => {
    if (tab !== "manage" || focusedUserId) return null;
    const visibleDepts = DEPARTMENTS.filter((d) => manageDeptFilter.size === 0 || manageDeptFilter.has(d));
    return visibleDepts.map((dept) => ({
      dept,
      people: (profilesArr ?? []).filter((p) => p.department === dept),
    }));
  }, [tab, focusedUserId, profilesArr, manageDeptFilter]);

  const focusedProfile = focusedUserId ? profiles.get(focusedUserId) : null;
  const showMatrix = tab === "mine" || (tab === "team" && !!teamDept) || (tab === "manage" && !!focusedUserId);
  const canEditMatrix = tab === "mine" || tab === "team" || (tab === "manage" && (focusedUserId === user?.id || isAdmin));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div className="min-w-0">
          {tab === "manage" && focusedUserId ? (
            <>
              <button onClick={() => setFocusedUserId(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
                <ArrowLeft size={12} /> Back to roster
              </button>
              <h1 className="text-3xl font-semibold flex items-center gap-2 flex-wrap">
                {focusedProfile?.name ?? focusedProfile?.email ?? "Teammate"}
                {focusedProfile?.department && <DepartmentBadge department={focusedProfile.department} />}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Personal matrix. Adding tasks here assigns them.</p>
            </>
          ) : tab === "team" ? (
            <>
              <h1 className="text-3xl font-semibold">Team Board</h1>
              <p className="text-sm text-muted-foreground mt-1">Shared priority matrix for the selected department. Anyone in the department can edit.</p>
            </>
          ) : tab === "manage" ? (
            <>
              <h1 className="text-3xl font-semibold">Manage</h1>
              <p className="text-sm text-muted-foreground mt-1">Click a teammate to view their personal matrix and assign tasks.</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-semibold">Your Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">Drag tasks between quadrants of your matrix to organize responsibilities.</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button onClick={() => setTab("mine")} className={cn("inline-flex items-center gap-1 px-3 py-1.5 rounded-sm transition relative", tab === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <User size={11} /> Mine
              {unackCount > 0 && tab !== "mine" && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] text-[9px] font-bold rounded-full bg-red-500 text-white px-0.5">{unackCount}</span>
              )}
            </button>
            <button onClick={() => setTab("team")} className={cn("inline-flex items-center gap-1 px-3 py-1.5 rounded-sm transition", tab === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Users size={11} /> Team
            </button>
            {isAdmin && (
              <button onClick={() => setTab("manage")} className={cn("inline-flex items-center gap-1 px-3 py-1.5 rounded-sm transition", tab === "manage" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                <Shield size={11} /> Manage
              </button>
            )}
          </div>
          {showMatrix && <div className="text-xs text-muted-foreground tabular-nums">{counts.total} open</div>}
          <div className="flex items-center">
            {searchOpen ? (
              <div className="flex items-center gap-1 border border-border rounded-md px-2 py-1 bg-card">
                <Search size={12} className="text-muted-foreground shrink-0" />
                <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setSearch(""); setSearchOpen(false); } }} placeholder="Search…" className="bg-transparent text-xs outline-none w-48 placeholder:text-muted-foreground/60" />
                <button onClick={() => { setSearch(""); setSearchOpen(false); }} className="text-muted-foreground hover:text-foreground"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition" title="Search"><Search size={14} /></button>
            )}
          </div>
        </div>
      </header>

      {/* Mine: assigned-to-me banner */}
      {tab === "mine" && assignedCount > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/[0.05] text-xs">
          <BellRing size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-medium">{assignedCount} task{assignedCount === 1 ? "" : "s"} assigned to you{unackCount > 0 ? ` (${unackCount} new)` : ""}.</span>
            <span className="text-muted-foreground"> Marking them done notifies the assigner.</span>
          </div>
        </div>
      )}

      {/* Team: department selector */}
      {tab === "team" && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Department</span>
          {DEPARTMENTS.map((d) => {
            const active = teamDept === d;
            const style = DEPARTMENT_STYLES[d];
            return (
              <button key={d} onClick={() => setTeamDept(d)} className={cn(
                "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide transition",
                active ? style : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}>{d}</button>
            );
          })}
          {teamDept && (
            <span className="text-[10px] text-muted-foreground ml-1">
              {(profilesArr ?? []).filter((p) => p.department === teamDept).length} member{(profilesArr ?? []).filter((p) => p.department === teamDept).length === 1 ? "" : "s"} share this board
            </span>
          )}
        </div>
      )}

      {/* Manage: dept filter */}
      {tab === "manage" && !focusedUserId && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Filter</span>
          {DEPARTMENTS.map((d) => {
            const active = manageDeptFilter.has(d);
            const style = DEPARTMENT_STYLES[d];
            return (
              <button key={d} onClick={() => {
                setManageDeptFilter((prev) => {
                  const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n;
                });
              }} className={cn(
                "inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide transition",
                active ? style : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}>{d}</button>
            );
          })}
          {manageDeptFilter.size > 0 && <button onClick={() => setManageDeptFilter(new Set())} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">Clear</button>}
        </div>
      )}

      {/* Manage roster */}
      {tab === "manage" && !focusedUserId && manageRoster && (
        <div className="space-y-6">
          {manageRoster.every((g) => g.people.length === 0) && <div className="text-sm text-muted-foreground italic px-1">No teammates match.</div>}
          {manageRoster.map((g) => g.people.length === 0 ? null : (
            <section key={g.dept}>
              <div className="flex items-center gap-2 mb-2"><DepartmentBadge department={g.dept} /><span className="text-xs text-muted-foreground">{g.people.length} {g.people.length === 1 ? "person" : "people"}</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {g.people.map((p) => (
                  <button key={p.id} onClick={() => setFocusedUserId(p.id)} className="flex items-center gap-3 p-3 rounded-md border border-border bg-card hover:border-foreground/30 hover:bg-muted/40 transition text-left">
                    <UserCircle2 size={20} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.display_name ?? p.email ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">View matrix · assign tasks</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Team needs dept selected */}
      {tab === "team" && !teamDept && (
        <div className="text-sm text-muted-foreground italic px-1">Select a department above to view its shared matrix.</div>
      )}

      {/* Matrix */}
      {showMatrix && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {QUADRANTS.map((q) => (
            <Quadrant
              key={q.key}
              quadrant={q}
              tasks={filteredTasks.filter((t) => t.urgent === q.urgent && t.important === q.important)}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              canEdit={canEditMatrix}
              profiles={profiles}
              dragId={dragId}
              setDragId={setDragId}
              onDrop={handleDrop}
              onUpdate={(id, patch, opts) => update.mutate({ id, patch, notify: opts?.notify })}
              onOpen={(id) => setDetailTaskId(id)}
              onCreate={(title) => create.mutate({ title, urgent: q.urgent, important: q.important })}
            />
          ))}
        </div>
      )}

      <TaskDetailDialog
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTaskId(null)}
        canEdit={!!detailTask && (
          isAdmin
          || (detailTask.scope === "team")
          || (detailTask.scope === "personal" && (detailTask.owner_id === user?.id || detailTask.assigned_to === user?.id))
        )}
        onSave={(patch) => detailTask && update.mutate({ id: detailTask.id, patch })}
        onDelete={() => detailTask && remove.mutate(detailTask.id)}
        onComplete={() => detailTask && update.mutate({ id: detailTask.id, patch: { done: true }, notify: !!detailTask.assigned_by })}
        profiles={profiles}
      />
    </div>
  );
}

function Quadrant({
  quadrant, tasks, currentUserId, isAdmin, canEdit, profiles, dragId, setDragId, onDrop, onUpdate, onOpen, onCreate,
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
  onOpen: (id: string) => void;
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
        {tasks.length === 0 && <div className="text-xs text-muted-foreground italic px-1">{canEdit ? "Drop a task here, or add below." : "No tasks."}</div>}
        {tasks.map((t) => {
          const isOwn = t.owner_id === currentUserId || t.assigned_to === currentUserId;
          const draggable = canEdit && (isOwn || isAdmin || t.scope === "team");
          const isAssigneeMe = t.assigned_to === currentUserId;
          const ownerName = t.scope === "team" ? null : (t.owner_id !== currentUserId ? (profiles.get(t.owner_id)?.name ?? null) : null);
          return (
            <TaskCard
              key={t.id}
              task={t}
              draggable={draggable}
              canEdit={canEdit}
              isAssigneeMe={isAssigneeMe}
              ownerName={ownerName}
              onDragStart={() => setDragId(t.id)}
              onDragEnd={() => setDragId(null)}
              onOpen={() => onOpen(t.id)}
              onMarkDone={() => onUpdate(t.id, { done: true }, { notify: !!t.assigned_by })}
              onAck={() => onUpdate(t.id, { acknowledged_at: new Date().toISOString() })}
            />
          );
        })}

        {canEdit && (
          <form onSubmit={(e) => { e.preventDefault(); if (!adding.trim()) return; onCreate(adding); setAdding(""); setTimeout(() => inputRef.current?.focus(), 50); }} className="flex items-center gap-1.5 mt-2">
            <Plus size={14} className="text-muted-foreground shrink-0" />
            <input ref={inputRef} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a task…" className="flex-1 bg-transparent text-sm py-1.5 px-1 outline-none placeholder:text-muted-foreground/60 focus:bg-card/60 rounded" />
          </form>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, draggable, canEdit, isAssigneeMe, ownerName, onDragStart, onDragEnd, onOpen, onMarkDone, onAck }: {
  task: Task;
  draggable: boolean;
  canEdit: boolean;
  isAssigneeMe: boolean;
  ownerName: string | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onMarkDone: () => void;
  onAck: () => void;
}) {
  const isAssigned = !!task.assigned_by;
  const needsAck = isAssigneeMe && isAssigned && !task.acknowledged_at;
  const dueSoon = task.due_date && new Date(task.due_date) < new Date(Date.now() + 1000 * 60 * 60 * 24 * 2);
  const overdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => { if (!draggable) { e.preventDefault(); return; } onDragStart(); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={onDragEnd}
      onClick={() => { if (needsAck) onAck(); onOpen(); }}
      className={cn(
        "bg-card border rounded-md p-2.5 text-sm group cursor-pointer hover:border-foreground/30 transition",
        needsAck ? "border-amber-500/60" : "border-border",
        draggable ? "active:cursor-grabbing" : "",
      )}
    >
      <div className="flex items-start gap-2">
        {draggable && <GripVertical size={14} className="text-muted-foreground/40 mt-0.5 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{task.title}</div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
            {task.due_date && (
              <span className={cn("inline-flex items-center gap-0.5", overdue ? "text-red-500" : dueSoon ? "text-amber-500" : "")}>
                <Calendar size={10} /> {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.notes && <FileText size={10} className="text-muted-foreground/70" />}
            {ownerName && <span>· {ownerName}</span>}
            {task.scope === "team" && task.department && <DepartmentBadge department={task.department} />}
            {isAssigned && (
              <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wide",
                needsAck ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40" : "bg-muted text-muted-foreground border-border"
              )}>
                {needsAck ? "New" : "Assigned"}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button title="Mark done" onClick={(e) => { e.stopPropagation(); onMarkDone(); }} className="text-emerald-500 hover:text-emerald-400 p-0.5"><Check size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDetailDialog({ task, open, onClose, canEdit, onSave, onDelete, onComplete, profiles }: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  onSave: (patch: Partial<Task>) => void;
  onDelete: () => void;
  onComplete: () => void;
  profiles: Map<string, Profile>;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? "");
      setNotes(task.notes ?? "");
      setDue(task.due_date ?? "");
    }
  }, [task?.id]);

  if (!task) return null;

  const dirty = title.trim() !== (task.title ?? "") || (notes ?? "") !== (task.notes ?? "") || (due ?? "") !== (task.due_date ?? "");
  const owner = profiles.get(task.owner_id);
  const assigner = task.assigned_by ? profiles.get(task.assigned_by) : null;
  const assignee = task.assigned_to ? profiles.get(task.assigned_to) : null;

  const save = () => {
    if (!dirty) return;
    onSave({
      title: title.trim() || task.title,
      notes: notes.trim() ? notes.trim() : null,
      due_date: due ? due : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Task details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              className="w-full mt-1 bg-transparent border border-border rounded-md px-2 py-1.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-60"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Due date</label>
              <input
                type="date"
                value={due ?? ""}
                onChange={(e) => setDue(e.target.value)}
                disabled={!canEdit}
                className="w-full mt-1 bg-transparent border border-border rounded-md px-2 py-1.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Scope</label>
              <div className="mt-1 px-2 py-1.5 text-sm border border-border rounded-md flex items-center gap-2">
                {task.scope === "team" ? <><Users size={12} /> Team{task.department ? ` · ${task.department}` : ""}</> : <><User size={12} /> Personal</>}
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit}
              rows={4}
              placeholder="Acceptance criteria, links, context…"
              className="w-full mt-1 bg-transparent border border-border rounded-md px-2 py-1.5 text-sm outline-none focus:border-foreground/40 disabled:opacity-60 resize-y"
            />
          </div>
          {(owner || assigner || assignee) && (
            <div className="text-[11px] text-muted-foreground space-y-0.5 border-t border-border pt-3">
              {task.scope === "personal" && owner && <div>Owner: <span className="text-foreground">{owner.name ?? owner.email ?? "—"}</span></div>}
              {assigner && <div>Assigned by: <span className="text-foreground">{assigner.name ?? assigner.email ?? "—"}</span></div>}
              {assignee && task.scope === "personal" && <div>Assignee: <span className="text-foreground">{assignee.name ?? assignee.email ?? "—"}</span></div>}
            </div>
          )}
        </div>
        <DialogFooter className="flex sm:justify-between gap-2">
          {canEdit ? (
            <button onClick={() => onDelete()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition">
              <Trash2 size={12} /> Delete
            </button>
          ) : <div />}
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => { onComplete(); onClose(); }} className="inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded border border-border text-emerald-500 hover:border-emerald-500/40 transition">
                <Check size={12} /> Complete
              </button>
            )}
            <button onClick={onClose} className="text-xs px-2 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition">Close</button>
            {canEdit && (
              <button disabled={!dirty} onClick={() => { save(); onClose(); }} className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed">Save</button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
