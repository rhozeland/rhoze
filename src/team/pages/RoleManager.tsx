import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronRight, Eye, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "../lib/auth";
import { formatPhone, validateAll, validateField, type MastersheetField } from "../lib/validation";

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_BLOCKS = ["Morning", "Afternoon", "Evening", "Overnight"];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_BLOCKS = ["Morning", "Afternoon", "Evening", "Overnight"];

type Role = "admin" | "employee" | "client";
const ROLES: Role[] = ["admin", "employee", "client"];
type Dept = "marketing" | "hr" | "development" | "sales" | "operations";
const DEPTS: { value: Dept; label: string }[] = [
  { value: "marketing", label: "Marketing" },
  { value: "hr", label: "HR" },
  { value: "development", label: "Development" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
];

const DEPT_STYLES: Record<Dept, string> = {
  marketing: "bg-pink-500/15 text-pink-600 dark:text-pink-300 border-pink-500/30",
  hr: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  development: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
  sales: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  operations: "bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30",
};

type EmpStatus = "active" | "on_leave" | "former" | "contractor" | "intern";
const EMP_STATUSES: { value: EmpStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On leave" },
  { value: "contractor", label: "Contractor" },
  { value: "intern", label: "Intern" },
  { value: "former", label: "Former" },
];

// Department → roles allow-list. `null` department (unassigned) only allows `client`.
const DEPT_ROLE_MATRIX: Record<Dept, Role[]> = {
  operations: ["admin", "employee"],
  hr: ["admin", "employee"],
  development: ["employee"],
  marketing: ["employee"],
  sales: ["employee", "client"],
};
const UNASSIGNED_ROLES: Role[] = ["client"];

// Admins have absolute control: any role can be granted to any user regardless
// of department. The DEPT_ROLE_MATRIX above is kept only for reference.
function allowedRoles(_dept: Dept | null | undefined): Role[] {
  return ROLES;
}

function validateRoleForDept(_role: Role, _dept: Dept | null | undefined): string | null {
  return null;
}

function tenure(start?: string | null, end?: string | null): string {
  if (!start) return "—";
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const months = Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y && m) return `${y}y ${m}m`;
  if (y) return `${y}y`;
  return `${m}m`;
}

function tenureMonths(start?: string | null, end?: string | null): number | null {
  if (!start) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

export default function RoleManager() {
  const qc = useQueryClient();
  const [picks, setPicks] = useState<Record<string, Role>>({});
  const [titleDrafts, setTitleDrafts] = useState<Record<string, string>>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [view, setView] = useState<"current" | "former" | "all">("current");
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Dept | "all" | "unassigned">("all");
  const [deptChips, setDeptChips] = useState<Set<Dept>>(new Set());
  const [deptOrder, setDeptOrder] = useState<Dept[]>(() => {
    try {
      const raw = localStorage.getItem("rolemanager.deptOrder");
      if (raw) {
        const parsed = JSON.parse(raw) as Dept[];
        const valid = parsed.filter((d) => DEPTS.some((x) => x.value === d));
        const missing = DEPTS.map((x) => x.value).filter((d) => !valid.includes(d));
        return [...valid, ...missing];
      }
    } catch {}
    return DEPTS.map((x) => x.value);
  });
  useEffect(() => {
    try { localStorage.setItem("rolemanager.deptOrder", JSON.stringify(deptOrder)); } catch {}
  }, [deptOrder]);
  const moveDept = (d: Dept, dir: -1 | 1) => {
    setDeptOrder((prev) => {
      const i = prev.indexOf(d);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const [statusFilter, setStatusFilter] = useState<EmpStatus | "all">("all");
  const [tenureMin, setTenureMin] = useState<string>("");
  const [tenureMax, setTenureMax] = useState<string>("");

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, alias, pronouns, email, avatar_url, department, job_title, employment_status, started_at, ended_at, employment_notes, work_type, wage, hourly_rate_cents, payment_method, program, phone, address, date_of_birth, emergency_contact_name, emergency_contact_relation, emergency_contact_phone")
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: availabilityMap } = useQuery({
    queryKey: ["team-availability-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_availability")
        .select("user_id, days, time_blocks, notes");
      if (error) throw error;
      const map: Record<string, { days: string[]; time_blocks: string[]; notes: string | null }> = {};
      (data ?? []).forEach((r: any) => {
        map[r.user_id] = { days: r.days ?? [], time_blocks: r.time_blocks ?? [], notes: r.notes ?? null };
      });
      return map;
    },
  });

  const { data: rolesByUser } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role, id");
      if (error) throw error;
      const map: Record<string, { role: Role; id: string }[]> = {};
      (data ?? []).forEach((r) => {
        (map[r.user_id] = map[r.user_id] || []).push({ role: r.role as Role, id: r.id });
      });
      return map;
    },
  });

  const grant = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Role granted" });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Role removed" });
      qc.invalidateQueries({ queryKey: ["all-roles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const setDept = useMutation({
    mutationFn: async ({ userId, department }: { userId: string; department: Dept | null }) => {
      const { error } = await supabase.from("profiles").update({ department }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Department updated" });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const setTitle = useMutation({
    mutationFn: async ({ userId, job_title }: { userId: string; job_title: string | null }) => {
      const { error } = await supabase.from("profiles").update({ job_title }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Job title updated" });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const setEmp = useMutation({
    mutationFn: async ({ userId, patch }: { userId: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    let list = profiles ?? [];
    if (view === "former") list = list.filter((p: any) => p.employment_status === "former");
    else if (view === "current") list = list.filter((p: any) => p.employment_status !== "former");

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p: any) =>
        [p.display_name, p.job_title, p.employment_notes, p.id]
          .filter(Boolean)
          .some((s: string) => String(s).toLowerCase().includes(q))
      );
    }

    if (deptFilter !== "all") {
      list = list.filter((p: any) =>
        deptFilter === "unassigned" ? !p.department : p.department === deptFilter
      );
    }

    if (deptChips.size > 0) {
      list = list.filter((p: any) => p.department && deptChips.has(p.department as Dept));
    }

    if (statusFilter !== "all") {
      list = list.filter((p: any) => (p.employment_status ?? "active") === statusFilter);
    }

    const min = tenureMin ? Number(tenureMin) : null;
    const max = tenureMax ? Number(tenureMax) : null;
    if (min !== null || max !== null) {
      list = list.filter((p: any) => {
        const m = tenureMonths(p.started_at, p.ended_at);
        if (m === null) return false;
        if (min !== null && m < min) return false;
        if (max !== null && m > max) return false;
        return true;
      });
    }

    return list;
  }, [profiles, view, search, deptFilter, deptChips, statusFilter, tenureMin, tenureMax]);

  const activeFilterCount =
    (deptFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (tenureMin ? 1 : 0) +
    (tenureMax ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setDeptFilter("all");
    setStatusFilter("all");
    setTenureMin("");
    setTenureMax("");
  };

  const counts = useMemo(() => {
    const list = profiles ?? [];
    return {
      current: list.filter((p: any) => p.employment_status !== "former").length,
      former: list.filter((p: any) => p.employment_status === "former").length,
      all: list.length,
    };
  }, [profiles]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Role manager</h1>
        <p className="text-sm text-muted-foreground">Grant team access, assign department and title, and track employment history. New users have no role until you assign one.</p>
      </header>

      <RolePresetsCombined />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Filter</span>
        {DEPTS.map(({ value: d, label }) => {
          const active = deptChips.has(d);
          return (
            <button
              key={d}
              onClick={() => setDeptChips((prev) => { const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n; })}
              className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide transition ${active ? DEPT_STYLES[d] : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}
            >
              {label}
            </button>
          );
        })}
        {deptChips.size > 0 && (
          <button onClick={() => setDeptChips(new Set())} className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1">Clear</button>
        )}
      </div>

      {(() => {
        const orderedDepts: Dept[] = [
          ...deptOrder,
          ...DEPTS.map((x) => x.value).filter((d) => !deptOrder.includes(d)),
        ];
        const visibleDepts = orderedDepts.filter((value) => deptChips.size === 0 || deptChips.has(value));
        const labelOf = (d: Dept) => DEPTS.find((x) => x.value === d)?.label ?? d;
        const groups: { dept: Dept | null; label: string; people: any[] }[] = visibleDepts.map((value) => ({
          dept: value,
          label: labelOf(value),
          people: filtered.filter((p: any) => p.department === value),
        }));
        if (deptChips.size === 0) {
          const unassigned = filtered.filter((p: any) => !p.department);
          if (unassigned.length > 0) groups.push({ dept: null, label: "Unassigned", people: unassigned });
        }
        const totalShown = groups.reduce((n, g) => n + g.people.length, 0);
        if (totalShown === 0) {
          return <div className="text-sm text-muted-foreground italic text-center py-8">No members match your filters.</div>;
        }
        return (
          <div className="space-y-6">
            {groups.map((g, gi) => g.people.length === 0 ? null : (
              <section key={g.label}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-medium uppercase tracking-wide ${g.dept ? DEPT_STYLES[g.dept] : "bg-muted text-muted-foreground border-border"}`}>{g.label}</span>
                  <span className="text-xs text-muted-foreground">{g.people.length} {g.people.length === 1 ? "person" : "people"}</span>
                  {g.dept && (
                    <div className="flex items-center gap-0.5 ml-1">
                      <button
                        type="button"
                        onClick={() => moveDept(g.dept as Dept, -1)}
                        disabled={deptOrder.indexOf(g.dept as Dept) <= 0}
                        className="p-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDept(g.dept as Dept, 1)}
                        disabled={deptOrder.indexOf(g.dept as Dept) >= deptOrder.length - 1}
                        className="p-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ArrowDown size={11} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {g.people.map((p: any) => {
          const cur = rolesByUser?.[p.id] ?? [];
          const isFormer = p.employment_status === "former";
          const av = availabilityMap?.[p.id];
          const hasAvail = av && ((av.days?.length ?? 0) > 0 || (av.time_blocks?.length ?? 0) > 0 || av.notes);
          const dept = (p.department ?? null) as Dept | null;
          const allowed = allowedRoles(dept);
          const hasAllowed = allowed.length > 0;
          const pick = picks[p.id] ?? (allowed[0] ?? "client");
          const err = errors[p.id];
          return (
            <div
              key={p.id}
              className={`border border-border rounded-lg p-4 bg-card ${isFormer ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-3">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                    {(p.display_name ?? p.email ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{p.display_name ?? "Unnamed"}</div>
                  {p.alias && <div className="text-xs text-muted-foreground truncate">aka {p.alias}</div>}
                  <div className="text-xs text-muted-foreground truncate">
                    {[p.job_title, p.pronouns].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="text-xs text-primary hover:underline truncate block mt-0.5">
                      {p.email}
                    </a>
                  )}
                </div>
                <Button size="sm" onClick={() => setEditingUid(p.id)}>Edit User Profile</Button>
              </div>
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Roles</div>
                <div className="flex flex-wrap gap-1.5">
                  {cur.length === 0 && !p.department && <span className="text-xs text-muted-foreground">none</span>}
                  {cur.map((r: any) => {
                    const invalid = !allowed.includes(r.role);
                    return (
                      <span key={r.id}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                          invalid ? "bg-destructive/10 text-destructive border border-destructive/40" : "bg-muted"
                        }`}>
                        {r.role}
                        {invalid && <span className="text-[10px] uppercase">invalid</span>}
                        <button onClick={() => revoke.mutate(r.id)} className="hover:text-destructive" aria-label={`Remove ${r.role}`}>
                          <Trash2 size={12} />
                        </button>
                      </span>
                    );
                  })}
                  {p.department && (
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${DEPT_STYLES[p.department as Dept]}`}>
                      {DEPTS.find((d) => d.value === p.department)?.label ?? p.department}
                      <button
                        onClick={() => setDept.mutate({ userId: p.id, department: null })}
                        className="hover:text-destructive"
                        aria-label={`Remove ${p.department} department`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  )}
                </div>
                <div className="flex gap-2 items-start">
                  <Select
                    value={pick}
                    onValueChange={(v) => {
                      setPicks({ ...picks, [p.id]: v as any });
                      if (v.startsWith("dept:")) {
                        setErrors({ ...errors, [p.id]: null });
                      } else {
                        setErrors({ ...errors, [p.id]: validateRoleForDept(v as Role, dept) });
                      }
                    }}
                  >
                    <SelectTrigger className={`h-9 flex-1 ${err ? "border-destructive" : ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Position</div>
                      {ROLES.map((r) => {
                        const disabled = !allowed.includes(r);
                        return (
                          <SelectItem key={r} value={r} disabled={disabled}>
                            {r}{disabled ? " — not allowed" : ""}
                          </SelectItem>
                        );
                      })}
                      <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground border-t border-border mt-1">Department</div>
                      {DEPTS.map((d) => (
                        <SelectItem key={`dept:${d.value}`} value={`dept:${d.value}`} disabled={p.department === d.value}>
                          {d.label}{p.department === d.value ? " — current" : ""}
                        </SelectItem>
                      ))}
                      <SelectItem value="dept:__none" disabled={!p.department}>
                        Unassigned{!p.department ? " — current" : " — remove department"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!!err || !hasAllowed}
                    onClick={() => {
                      if (typeof pick === "string" && pick.startsWith("dept:")) {
                        const raw = pick.slice(5);
                        const newDept = raw === "__none" ? null : (raw as Dept);
                        setDept.mutate({ userId: p.id, department: newDept });
                        return;
                      }
                      const v = validateRoleForDept(pick as Role, dept);
                      if (v) {
                        setErrors({ ...errors, [p.id]: v });
                        toast({ title: "Role not allowed", description: v, variant: "destructive" });
                        return;
                      }
                      grant.mutate({ userId: p.id, role: pick as Role });
                    }}
                  >
                    Add role
                  </Button>
                </div>
                {err && <div className="text-[11px] text-destructive">{err}</div>}
              </div>
              {hasAvail && (
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-[11px]">
                  <div className="uppercase tracking-wide text-muted-foreground">Availability</div>
                  {av!.days.length > 0 && <div><span className="text-muted-foreground">Days:</span> {av!.days.map((d) => d.slice(0,3)).join(", ")}</div>}
                  {av!.time_blocks.length > 0 && <div><span className="text-muted-foreground">When:</span> {av!.time_blocks.join(", ")}</div>}
                  {av!.notes && <div className="text-muted-foreground italic">{av!.notes}</div>}
                </div>
              )}
            </div>
          );
        })}
                </div>
              </section>
            ))}
          </div>
        );
      })()}

      <Dialog open={!!editingUid} onOpenChange={(o) => !o && setEditingUid(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit mastersheet{editingUid && (() => {
                const p = (profiles ?? []).find((x: any) => x.id === editingUid);
                return p ? ` — ${p.display_name ?? p.email ?? ""}` : "";
              })()}
            </DialogTitle>
          </DialogHeader>
          {editingUid && (
            <EditMemberDialogBody
              userId={editingUid}
              profile={(profiles ?? []).find((x: any) => x.id === editingUid)}
              availability={availabilityMap?.[editingUid]}
              roles={rolesByUser?.[editingUid] ?? []}
              picks={picks}
              setPicks={setPicks}
              errors={errors}
              setErrors={setErrors}
              titleDrafts={titleDrafts}
              setTitleDrafts={setTitleDrafts}
              notesDrafts={notesDrafts}
              setNotesDrafts={setNotesDrafts}
              setDept={setDept}
              setTitle={setTitle}
              setEmp={setEmp}
              grant={grant}
              revoke={revoke}
              onDeleted={() => setEditingUid(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditMemberDialogBody({
  userId, profile: p, availability: av, roles: cur, picks, setPicks, errors, setErrors,
  titleDrafts, setTitleDrafts, notesDrafts, setNotesDrafts,
  setDept, setTitle, setEmp, grant, revoke,
}: any) {
  if (!p) return null;
  const qc = useQueryClient();
  const titleVal = titleDrafts[p.id] ?? p.job_title ?? "";
  const notesVal = notesDrafts[p.id] ?? p.employment_notes ?? "";
  const dept = (p.department ?? null) as Dept | null;
  const allowed = allowedRoles(dept);
  const pick = picks[p.id] ?? allowed[0] ?? "employee";
  const err = errors[p.id] ?? validateRoleForDept(pick as Role, dept);
  const hasAllowed = allowed.length > 0;
  const [wageDraft, setWageDraft] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const [preview, setPreview] = useState(true);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState<string | null>(null);
  const [ecNameDraft, setEcNameDraft] = useState<string | null>(null);
  const [ecRelDraft, setEcRelDraft] = useState<string | null>(null);
  const [ecPhoneDraft, setEcPhoneDraft] = useState<string | null>(null);
  const [availNotesDraft, setAvailNotesDraft] = useState<string | null>(null);
  const wageVal = wageDraft ?? p.wage ?? "";
  const rateVal = rateDraft ?? (p.hourly_rate_cents != null ? (p.hourly_rate_cents / 100).toString() : "");
  const fmtRate = p.hourly_rate_cents ? `$${(p.hourly_rate_cents / 100).toFixed(2)}/hr` : "—";
  const deptLabel = DEPTS.find((d) => d.value === p.department)?.label ?? "—";
  const statusLabel = EMP_STATUSES.find((s) => s.value === (p.employment_status ?? "active"))?.label ?? "—";
  const availDays: string[] = av?.days ?? [];
  const availBlocks: string[] = av?.time_blocks ?? [];
  const availNotes: string = (availNotesDraft ?? av?.notes ?? "") as string;

  const saveAvail = useMutation({
    mutationFn: async (next: { days: string[]; time_blocks: string[]; notes: string | null }) => {
      // Derive `slots` (cell keys "Day|Block") so the user-facing AvailabilityEditor,
      // which reads `slots` preferentially, stays in sync with admin edits here.
      const slots = next.days.flatMap((d) => next.time_blocks.map((b) => `${d}|${b}`));
      const tz = (() => {
        try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
        catch { return "UTC"; }
      })();
      const { error } = await supabase
        .from("team_availability")
        .upsert({ user_id: p.id, ...next, slots, timezone: tz }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-availability-all"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  const toggleAvail = (key: "days" | "time_blocks", v: string) => {
    const cur = key === "days" ? availDays : availBlocks;
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    saveAvail.mutate({
      days: key === "days" ? next : availDays,
      time_blocks: key === "time_blocks" ? next : availBlocks,
      notes: (availNotesDraft ?? av?.notes ?? null) as any,
    });
  };

  const PreviewRow = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xs text-right">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => setPreview((v) => !v)}
          aria-pressed={!preview}
          className="h-9 rounded-full px-4 text-sm font-medium bg-gradient-mint text-primary-foreground hover:opacity-90 shadow-sm transition-opacity"
        >
          {preview ? (<><Pencil size={14} className="mr-1.5" /> Edit mastersheet</>) : (<><Eye size={14} className="mr-1.5" /> Preview mastersheet</>)}
        </Button>
      </div>

      {/* Header — avatar, name, alias, title/pronouns, email */}
      <div className="flex items-start gap-4">
        {p.avatar_url ? (
          <img src={p.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border border-border shrink-0" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-lg font-medium border border-border shrink-0">
            {(p.display_name ?? p.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xl font-semibold leading-tight truncate">{p.display_name ?? "Unnamed"}</div>
          {p.alias && <div className="text-sm text-muted-foreground truncate">aka {p.alias}</div>}
          <div className="text-sm text-muted-foreground truncate">
            {[p.job_title, p.pronouns].filter(Boolean).join(" · ") || "—"}
          </div>
          {p.email && (
            <a href={`mailto:${p.email}`} className="text-sm text-primary hover:underline truncate block mt-0.5 break-all">
              {p.email}
            </a>
          )}
        </div>
      </div>

      {preview ? (
        <>
          <section className="space-y-1.5 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Personal & emergency</div>
            <div><span className="text-muted-foreground">Phone:</span> {p.phone || "—"}</div>
            <div><span className="text-muted-foreground">Date of birth:</span> {p.date_of_birth || "—"}</div>
            <div><span className="text-muted-foreground">Address:</span> {p.address || "—"}</div>
            <div className="pt-2 text-[11px] uppercase tracking-wider text-muted-foreground">Emergency contact</div>
            <div><span className="text-muted-foreground">Name:</span> {p.emergency_contact_name || "—"}</div>
            <div><span className="text-muted-foreground">Relation:</span> {p.emergency_contact_relation || "—"}</div>
            <div><span className="text-muted-foreground">Phone:</span> {p.emergency_contact_phone || "—"}</div>
          </section>
          <section className="space-y-1.5 text-sm">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Availability</div>
            <div><span className="text-muted-foreground">Days:</span> {availDays.length ? availDays.join(", ") : "—"}</div>
            <div><span className="text-muted-foreground">Time of day:</span> {availBlocks.length ? availBlocks.join(", ") : "—"}</div>
            {av?.notes && <div className="text-muted-foreground italic">{av.notes}</div>}
          </section>
        </>
      ) : (
        <>
          <section className="border border-border rounded p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Personal & emergency</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Phone</label>
                <Input className="h-9" inputMode="tel" placeholder="(416) 555-0123"
                  value={phoneDraft ?? p.phone ?? ""}
                  onChange={(e) => setPhoneDraft(formatPhone(e.target.value))}
                  onBlur={() => {
                    if (phoneDraft === null) return;
                    const next = phoneDraft.trim();
                    if (next !== (p.phone ?? "")) setEmp.mutate({ userId: p.id, patch: { phone: next || null } });
                    setPhoneDraft(null);
                  }} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Date of birth</label>
                <Input type="date" className="h-9" max={new Date().toISOString().slice(0, 10)} min="1900-01-01"
                  value={p.date_of_birth ?? ""}
                  onChange={(e) => setEmp.mutate({ userId: p.id, patch: { date_of_birth: e.target.value || null } })} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase text-muted-foreground">Address</label>
                <Textarea rows={2}
                  value={addressDraft ?? p.address ?? ""}
                  onChange={(e) => setAddressDraft(e.target.value)}
                  onBlur={() => {
                    if (addressDraft === null) return;
                    const next = addressDraft.trim();
                    if (next !== (p.address ?? "")) setEmp.mutate({ userId: p.id, patch: { address: next || null } });
                    setAddressDraft(null);
                  }} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Emergency name</label>
                <Input className="h-9" maxLength={80}
                  value={ecNameDraft ?? p.emergency_contact_name ?? ""}
                  onChange={(e) => setEcNameDraft(e.target.value)}
                  onBlur={() => {
                    if (ecNameDraft === null) return;
                    const next = ecNameDraft.trim();
                    if (next !== (p.emergency_contact_name ?? "")) setEmp.mutate({ userId: p.id, patch: { emergency_contact_name: next || null } });
                    setEcNameDraft(null);
                  }} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Relation</label>
                <Input className="h-9" maxLength={40} placeholder="Mother, Sibling…"
                  value={ecRelDraft ?? p.emergency_contact_relation ?? ""}
                  onChange={(e) => setEcRelDraft(e.target.value)}
                  onBlur={() => {
                    if (ecRelDraft === null) return;
                    const next = ecRelDraft.trim();
                    if (next !== (p.emergency_contact_relation ?? "")) setEmp.mutate({ userId: p.id, patch: { emergency_contact_relation: next || null } });
                    setEcRelDraft(null);
                  }} />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] uppercase text-muted-foreground">Emergency phone</label>
                <Input className="h-9" inputMode="tel" placeholder="(416) 555-0123"
                  value={ecPhoneDraft ?? p.emergency_contact_phone ?? ""}
                  onChange={(e) => setEcPhoneDraft(formatPhone(e.target.value))}
                  onBlur={() => {
                    if (ecPhoneDraft === null) return;
                    const next = ecPhoneDraft.trim();
                    if (next !== (p.emergency_contact_phone ?? "")) setEmp.mutate({ userId: p.id, patch: { emergency_contact_phone: next || null } });
                    setEcPhoneDraft(null);
                  }} />
              </div>
            </div>
          </section>

          <section className="border border-border rounded p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Availability</div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Days</div>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const on = availDays.includes(d);
                  return (
                    <button key={d} type="button"
                      onClick={() => toggleAvail("days", d)}
                      className={`px-2 py-0.5 rounded text-[11px] border ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-1.5">Time of day</div>
              <div className="flex flex-wrap gap-1.5">
                {TIME_BLOCKS.map((b) => {
                  const on = availBlocks.includes(b);
                  return (
                    <button key={b} type="button"
                      onClick={() => toggleAvail("time_blocks", b)}
                      className={`px-2 py-0.5 rounded text-[11px] border ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Notes</label>
              <Textarea rows={2}
                value={availNotes}
                onChange={(e) => setAvailNotesDraft(e.target.value)}
                onBlur={() => {
                  if (availNotesDraft === null) return;
                  const next = availNotesDraft.trim();
                  if (next !== (av?.notes ?? "")) {
                    saveAvail.mutate({ days: availDays, time_blocks: availBlocks, notes: next || null });
                  }
                  setAvailNotesDraft(null);
                }} />
            </div>
          </section>
        </>
      )}

      {preview ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <section className="border border-border rounded p-3 bg-background">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Employment</div>
            <PreviewRow label="Department" value={deptLabel} />
            <PreviewRow label="Job title" value={p.job_title} />
            <PreviewRow label="Status" value={statusLabel} />
            <PreviewRow label="Tenure" value={tenure(p.started_at, p.ended_at)} />
            <PreviewRow label="Started" value={p.started_at} />
            <PreviewRow label="Ended" value={p.ended_at} />
            <PreviewRow label="Notes" value={p.employment_notes} />
          </section>
          <section className="border border-border rounded p-3 bg-background">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Payroll</div>
            <PreviewRow label="Work type" value={p.work_type} />
            <PreviewRow label="Wage" value={p.wage} />
            <PreviewRow label="Hourly rate" value={fmtRate} />
            <PreviewRow label="Payment method" value={p.payment_method} />
            <PreviewRow label="Program" value={p.program} />
          </section>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Department</label>
          <Select
            value={p.department ?? "__none"}
            onValueChange={(v) => setDept.mutate({ userId: p.id, department: v === "__none" ? null : (v as Dept) })}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Unassigned</SelectItem>
              {DEPTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Job title</label>
          <Input
            className="h-9"
            placeholder="e.g. Lead Designer"
            value={titleVal}
            onChange={(e) => setTitleDrafts({ ...titleDrafts, [p.id]: e.target.value })}
            onBlur={() => {
              const next = (titleDrafts[p.id] ?? "").trim();
              if (next !== (p.job_title ?? "")) setTitle.mutate({ userId: p.id, job_title: next || null });
            }}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Status</label>
          <Select
            value={p.employment_status ?? "active"}
            onValueChange={(v) => setEmp.mutate({ userId: p.id, patch: { employment_status: v } })}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Tenure</label>
          <div className="h-9 flex items-center text-xs text-muted-foreground">{tenure(p.started_at, p.ended_at)}</div>
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Started</label>
          <Input type="date" className="h-9" value={p.started_at ?? ""}
            onChange={(e) => setEmp.mutate({ userId: p.id, patch: { started_at: e.target.value || null } })} />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Ended</label>
          <Input type="date" className="h-9" value={p.ended_at ?? ""}
            onChange={(e) => setEmp.mutate({ userId: p.id, patch: { ended_at: e.target.value || null } })} />
        </div>
        <div className="md:col-span-2 pt-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Payroll</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Work type</label>
              <Select
                value={p.work_type || "__none"}
                onValueChange={(v) => setEmp.mutate({ userId: p.id, patch: { work_type: v === "__none" ? null : v } })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {WORK_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Wage (notes)</label>
              <Input
                className="h-9"
                placeholder="$19.50/hour, Equity…"
                value={wageVal}
                onChange={(e) => setWageDraft(e.target.value)}
                onBlur={() => {
                  if (wageDraft === null) return;
                  const next = wageDraft.trim();
                  if (next !== (p.wage ?? "")) setEmp.mutate({ userId: p.id, patch: { wage: next || null } });
                  setWageDraft(null);
                }}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Hourly rate ($/hr)</label>
              <Input
                className="h-9"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={rateVal}
                onChange={(e) => setRateDraft(e.target.value)}
                onBlur={() => {
                  if (rateDraft === null) return;
                  const n = parseFloat(rateDraft || "0");
                  const cents = Number.isFinite(n) ? Math.round(n * 100) : 0;
                  if (cents !== (p.hourly_rate_cents ?? 0)) setEmp.mutate({ userId: p.id, patch: { hourly_rate_cents: cents } });
                  setRateDraft(null);
                }}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground">Payment method</label>
              <Select
                value={p.payment_method || "__none"}
                onValueChange={(v) => setEmp.mutate({ userId: p.id, patch: { payment_method: v === "__none" ? null : v } })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase text-muted-foreground">Program</label>
              <Select
                value={p.program || "__none"}
                onValueChange={(v) => setEmp.mutate({ userId: p.id, patch: { program: v === "__none" ? null : v } })}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {PROGRAMS.map((pr) => <SelectItem key={pr} value={pr}>{pr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase text-muted-foreground">Employment notes</label>
          <Input
            className="h-9"
            placeholder="e.g. promoted Q2, left amicably"
            value={notesVal}
            onChange={(e) => setNotesDrafts({ ...notesDrafts, [p.id]: e.target.value })}
            onBlur={() => {
              const next = (notesDrafts[p.id] ?? "").trim();
              if (next !== (p.employment_notes ?? "")) setEmp.mutate({ userId: p.id, patch: { employment_notes: next || null } });
            }}
          />
        </div>
      </div>
      )}
    </div>
  );
}

type Preset = { id: string; kind: "department" | "job_title" | "position"; label: string; sort_order: number };

function RolePresetsCombined() {
  return (
    <div className="border border-border rounded-lg p-4 bg-card space-y-5">
      <div>
        <div className="text-sm font-semibold">Roles</div>
        <p className="text-xs text-muted-foreground">Manage positions and departments. Built-in departments control what employees can view.</p>
      </div>
      <RolePresetsSection
        kind="position"
        title="Position"
        description="Positions assignable to team members."
        placeholder="e.g. moderator"
      />
      <RolePresetsSection
        kind="department"
        title="Departments"
        description="Custom departments. Built-ins below are read-only and gate employee visibility."
        placeholder="e.g. Production"
        builtIns={DEPTS.map((d) => d.label)}
      />
    </div>
  );
}

function RolePresetsSection({ kind, title, description, placeholder, builtIns }: { kind: "position" | "department"; title: string; description: string; placeholder: string; builtIns?: string[] }) {
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { data: presets } = useQuery({
    queryKey: ["role-presets", kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_presets" as any)
        .select("id, kind, label, sort_order")
        .eq("kind", kind)
        .order("sort_order")
        .order("label");
      if (error) throw error;
      return ((data ?? []) as unknown) as Preset[];
    },
  });

  const create = useMutation({
    mutationFn: async (p: { label: string }) => {
      const { error } = await supabase.from("role_presets" as any).insert({ kind, label: p.label });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewLabel("");
      toast({ title: `${title} added` });
      qc.invalidateQueries({ queryKey: ["role-presets", kind] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async (p: { id: string; label: string }) => {
      const { error } = await supabase.from("role_presets" as any).update({ label: p.label }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      toast({ title: `${title} updated` });
      qc.invalidateQueries({ queryKey: ["role-presets", kind] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("role_presets" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${title} deleted` });
      qc.invalidateQueries({ queryKey: ["role-presets", kind] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const filtered = presets ?? [];

  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground">{description}</p>

      <div className="mt-3 flex gap-2">
        <Input
          className="h-9 flex-1"
          placeholder={placeholder}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newLabel.trim()) create.mutate({ label: newLabel.trim() });
          }}
        />
        <Button
          size="sm"
          onClick={() => newLabel.trim() && create.mutate({ label: newLabel.trim() })}
          disabled={!newLabel.trim() || create.isPending}
        >
          <Plus size={14} /> Add
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {builtIns?.map((label) => (
          <div key={`builtin-${label}`} className="group relative inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-muted">
            <span>{label}</span>
            <button
              onClick={() => toast({ title: "Built-in departments can't be edited." })}
              className="hover:text-primary"
              aria-label={`Edit ${label}`}
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => toast({ title: "Built-in departments can't be deleted." })}
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
              aria-label={`Delete ${label}`}
            >
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && !builtIns?.length && <span className="text-xs text-muted-foreground">None yet.</span>}
        {filtered.map((p) => {
          const editing = editingId === p.id;
          return (
            <div key={p.id} className="group relative inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-muted">
              {editing ? (
                <>
                  <Input
                    className="h-7 w-44"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editLabel.trim()) update.mutate({ id: p.id, label: editLabel.trim() });
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => editLabel.trim() && update.mutate({ id: p.id, label: editLabel.trim() })}
                    className="hover:text-primary"
                    aria-label="Save"
                  >
                    <Save size={12} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="hover:text-destructive" aria-label="Cancel">
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <span>{p.label}</span>
                  <button
                    onClick={() => {
                      setEditingId(p.id);
                      setEditLabel(p.label);
                    }}
                    className="hover:text-primary"
                    aria-label={`Edit ${p.label}`}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${p.label}"?`)) remove.mutate(p.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    aria-label={`Delete ${p.label}`}
                  >
                    <X size={10} strokeWidth={3} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const WORK_TYPES = ["Remote", "Hybrid", "In-Studio", "On-Site"];
const PAYMENT_METHODS = ["QuickBooks", "Interac e-Transfer", "Cash", "Cheque", "Equity", "Other"];
const PROGRAMS = ["In-House", "Signed", "Ambassador", "Partner", "Affiliate"];

function MastersheetPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const { data: profile, isLoading } = useQuery({
    queryKey: ["mastersheet", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("phone, address, date_of_birth, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, wage, hourly_rate_cents, payment_method, work_type, stage_name, program, internal_notes")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const val = (k: string) => draft[k] ?? (profile as any)?.[k] ?? "";

  // Live validation only for known validated fields
  const validatedFields: MastersheetField[] = [
    "phone", "date_of_birth", "emergency_contact_name", "emergency_contact_relation", "emergency_contact_phone",
  ];
  const errors = useMemo(() => {
    const subset: Partial<Record<MastersheetField, string>> = {};
    validatedFields.forEach((k) => {
      if (k in draft) subset[k] = draft[k] ?? "";
    });
    return validateAll(subset);
  }, [draft]);
  const hasErrors = Object.keys(errors).length > 0;

  const setField = (k: string, v: string) => setDraft({ ...draft, [k]: v });
  const setPhoneField = (k: "phone" | "emergency_contact_phone", raw: string) => setField(k, formatPhone(raw));

  const save = useMutation({
    mutationFn: async () => {
      // Re-validate everything in the draft before saving
      const allErrors = validateAll(draft as any);
      if (Object.keys(allErrors).length > 0) {
        const first = Object.values(allErrors)[0];
        throw new Error(first ?? "Please fix the highlighted fields");
      }
      const patch: Record<string, any> = {};
      Object.keys(draft).forEach((k) => {
        if (k === "hourly_rate_cents") {
          const n = parseFloat(draft[k] || "0");
          patch[k] = Number.isFinite(n) ? Math.round(n * 100) : 0;
        } else {
          patch[k] = draft[k] === "" ? null : draft[k];
        }
      });
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mastersheet saved" });
      setDraft({});
      setMode("preview");
      qc.invalidateQueries({ queryKey: ["mastersheet", userId] });
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const { data: avail } = useQuery({
    queryKey: ["availability", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_availability")
        .select("days, time_blocks, notes")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [availDraft, setAvailDraft] = useState<{ days: string[]; time_blocks: string[]; notes: string } | null>(null);
  const currentAvail = availDraft ?? {
    days: avail?.days ?? [],
    time_blocks: avail?.time_blocks ?? [],
    notes: avail?.notes ?? "",
  };
  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const saveAvail = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        days: currentAvail.days,
        time_blocks: currentAvail.time_blocks,
        notes: currentAvail.notes.trim() || null,
      };
      const { error } = await supabase.from("team_availability").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Availability updated" });
      setAvailDraft(null);
      qc.invalidateQueries({ queryKey: ["availability", userId] });
      qc.invalidateQueries({ queryKey: ["team-availability-all"] });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const clearAvail = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_availability").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Availability cleared" });
      setAvailDraft(null);
      qc.invalidateQueries({ queryKey: ["availability", userId] });
      qc.invalidateQueries({ queryKey: ["team-availability-all"] });
    },
    onError: (e: any) => toast({ title: "Clear failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading mastersheet…</div>;

  const dirty = Object.keys(draft).length > 0;

  // Preview is contingent on the Personal & emergency block being filled in.
  const personalEmergencyKeys = [
    "phone", "address", "date_of_birth",
    "emergency_contact_name", "emergency_contact_relation", "emergency_contact_phone",
  ] as const;
  const personalFilled = personalEmergencyKeys.some((k) => {
    const v = (profile as any)?.[k];
    return v !== null && v !== undefined && String(v).trim() !== "";
  });

  if (mode === "preview" && personalFilled && !dirty) {
    const p: any = profile ?? {};
    const Row = ({ label, value }: { label: string; value: any }) => {
      const display = value === null || value === undefined || value === "" ? "—" : String(value);
      return (
        <div className="flex justify-between gap-3 py-1 border-b border-border/50 last:border-0">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="text-xs text-right">{display}</span>
        </div>
      );
    };
    const rate = p.hourly_rate_cents ? `$${(p.hourly_rate_cents / 100).toFixed(2)}/hr` : "—";
    return (
      <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
        <section className="border border-border rounded p-3 bg-background">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contact</div>
            <Eye size={12} className="text-muted-foreground" />
          </div>
          <Row label="Phone" value={p.phone} />
          <Row label="Address" value={p.address} />
          <Row label="Date of birth" value={p.date_of_birth} />
        </section>
        <section className="border border-border rounded p-3 bg-background">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Emergency contact</div>
          <Row label="Name" value={p.emergency_contact_name} />
          <Row label="Relation" value={p.emergency_contact_relation} />
          <Row label="Phone" value={p.emergency_contact_phone} />
          <Row label="Program" value={p.program} />
        </section>
        <section className="border border-border rounded p-3 bg-background">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Payroll</div>
          <Row label="Work type" value={p.work_type} />
          <Row label="Wage" value={p.wage} />
          <Row label="Hourly rate" value={rate} />
          <Row label="Payment method" value={p.payment_method} />
          <Row label="Internal notes" value={p.internal_notes} />
        </section>
        <div className="lg:col-span-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
            <Pencil size={12} className="mr-1.5" />
            Edit mastersheet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
      <section className="border border-border rounded p-3 bg-background space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contact</div>
        <Field label="Phone" error={errors.phone} hint="e.g. (416) 555-0123 or +1 416 555 0123">
          <Input className="h-8" inputMode="tel" placeholder="(416) 555-0123"
            value={val("phone")} onChange={(e) => setPhoneField("phone", e.target.value)} />
        </Field>
        <Field label="Address"><Textarea rows={2} value={val("address")} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
        <Field label="Date of birth" error={errors.date_of_birth}>
          <Input type="date" className="h-8" max={new Date().toISOString().slice(0, 10)} min="1900-01-01"
            value={val("date_of_birth")} onChange={(e) => setField("date_of_birth", e.target.value)} />
        </Field>
      </section>

      <section className="border border-border rounded p-3 bg-background space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Emergency contact</div>
        <Field label="Name" error={errors.emergency_contact_name}>
          <Input className="h-8" maxLength={80} value={val("emergency_contact_name")}
            onChange={(e) => setField("emergency_contact_name", e.target.value)} />
        </Field>
        <Field label="Relation" error={errors.emergency_contact_relation}>
          <Input className="h-8" maxLength={40} placeholder="Mother, Sibling…" value={val("emergency_contact_relation")}
            onChange={(e) => setField("emergency_contact_relation", e.target.value)} />
        </Field>
        <Field label="Phone" error={errors.emergency_contact_phone}>
          <Input className="h-8" inputMode="tel" placeholder="(416) 555-0123"
            value={val("emergency_contact_phone")} onChange={(e) => setPhoneField("emergency_contact_phone", e.target.value)} />
        </Field>

        <div className="text-[10px] uppercase tracking-wide text-muted-foreground pt-2">Program</div>
        <Select value={val("program") || "__none"} onValueChange={(v) => setDraft({ ...draft, program: v === "__none" ? "" : v })}>
          <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">—</SelectItem>
            {PROGRAMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </section>

      <section className="border border-border rounded p-3 bg-background space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Payroll</div>
        <Field label="Work type">
          <Select value={val("work_type") || "__none"} onValueChange={(v) => setDraft({ ...draft, work_type: v === "__none" ? "" : v })}>
            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {WORK_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Wage (notes)"><Input className="h-8" placeholder="$19.50/hour, Equity…" value={val("wage")} onChange={(e) => setDraft({ ...draft, wage: e.target.value })} /></Field>
        <Field label="Hourly rate ($/hr)">
          <Input
            className="h-8"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={
              "hourly_rate_cents" in draft
                ? draft.hourly_rate_cents
                : (((profile as any)?.hourly_rate_cents ?? 0) / 100).toString()
            }
            onChange={(e) => setDraft({ ...draft, hourly_rate_cents: e.target.value })}
          />
        </Field>
        <Field label="Payment method">
          <Select value={val("payment_method") || "__none"} onValueChange={(v) => setDraft({ ...draft, payment_method: v === "__none" ? "" : v })}>
            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Internal notes"><Textarea rows={2} value={val("internal_notes")} onChange={(e) => setDraft({ ...draft, internal_notes: e.target.value })} /></Field>
      </section>

      <div className="lg:col-span-3 flex justify-end">
        <div className="flex items-center gap-3">
          {personalFilled && (
            <Button size="sm" variant="ghost" onClick={() => { setDraft({}); setMode("preview"); }}>
              <Eye size={12} className="mr-1.5" />
              Preview
            </Button>
          )}
          {hasErrors && <span className="text-[11px] text-destructive">Fix the highlighted fields</span>}
          <Button size="sm" disabled={!dirty || hasErrors || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : dirty ? "Save mastersheet" : "Saved"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, error, hint }: { label: string; children: React.ReactNode; error?: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
      {error
        ? <div className="text-[10px] text-destructive">{error}</div>
        : hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function CoveragePanel({ profiles }: { profiles: any[] }) {
  const [open, setOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [windowDays, setWindowDays] = useState<string[]>([...WEEK_DAYS]);
  const [windowBlocks, setWindowBlocks] = useState<string[]>([...DAY_BLOCKS]);

  const { data: availability } = useQuery({
    queryKey: ["coverage-availability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_availability")
        .select("user_id, days, time_blocks");
      if (error) throw error;
      const map: Record<string, { days: string[]; time_blocks: string[] }> = {};
      (data ?? []).forEach((r: any) => {
        map[r.user_id] = { days: r.days ?? [], time_blocks: r.time_blocks ?? [] };
      });
      return map;
    },
    enabled: open,
  });

  const profileMap = useMemo(() => {
    const m: Record<string, any> = {};
    profiles.forEach((p) => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const toggle = (arr: string[], v: string) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  // For each (day, block) cell in the window, list which selected users are available.
  // A user is "available" in (day, block) if their availability includes that day AND that block.
  const analysis = useMemo(() => {
    if (!availability || selectedUsers.length < 2 || windowDays.length === 0 || windowBlocks.length === 0) return null;
    const cells: { day: string; block: string; available: string[]; missing: string[] }[] = [];
    let fullyCovered = 0;
    let partial = 0;
    let empty = 0;
    windowDays.forEach((d) => {
      windowBlocks.forEach((b) => {
        const available: string[] = [];
        const missing: string[] = [];
        selectedUsers.forEach((uid) => {
          const av = availability[uid];
          const ok = av && (av.days ?? []).includes(d) && (av.time_blocks ?? []).includes(b);
          if (ok) available.push(uid);
          else missing.push(uid);
        });
        cells.push({ day: d, block: b, available, missing });
        if (available.length === selectedUsers.length) fullyCovered++;
        else if (available.length === 0) empty++;
        else partial++;
      });
    });
    // Per-person summary: which people never overlap with everyone else in the window
    const perPersonGaps: Record<string, number> = {};
    selectedUsers.forEach((uid) => { perPersonGaps[uid] = 0; });
    cells.forEach((c) => c.missing.forEach((uid) => { perPersonGaps[uid] = (perPersonGaps[uid] ?? 0) + 1; }));
    return { cells, fullyCovered, partial, empty, total: cells.length, perPersonGaps };
  }, [availability, selectedUsers, windowDays, windowBlocks]);

  const eligible = useMemo(
    () => profiles.filter((p) => p.employment_status !== "former"),
    [profiles]
  );

  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-sm font-medium">Coverage check</div>
          <div className="text-xs text-muted-foreground">Pick 2+ people and a time window — get an alert if their availability doesn't overlap.</div>
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {/* People picker */}
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">People ({selectedUsers.length})</div>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {eligible.map((p: any) => {
                const on = selectedUsers.includes(p.id);
                return (
                  <button key={p.id} type="button"
                    onClick={() => setSelectedUsers(toggle(selectedUsers, p.id))}
                    className={`px-2 py-0.5 rounded text-[11px] border ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>
                    {p.display_name ?? "Unnamed"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Window picker */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Days in window</div>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_DAYS.map((d) => {
                  const on = windowDays.includes(d);
                  return (
                    <button key={d} type="button"
                      onClick={() => setWindowDays(toggle(windowDays, d))}
                      className={`px-2 py-0.5 rounded text-[11px] border ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">Blocks in window</div>
              <div className="flex flex-wrap gap-1.5">
                {DAY_BLOCKS.map((b) => {
                  const on = windowBlocks.includes(b);
                  return (
                    <button key={b} type="button"
                      onClick={() => setWindowBlocks(toggle(windowBlocks, b))}
                      className={`px-2 py-0.5 rounded text-[11px] border ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Result */}
          {!analysis ? (
            <div className="text-xs text-muted-foreground italic">
              {selectedUsers.length < 2
                ? "Select at least 2 people."
                : "Pick at least one day and one block."}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Top-level alert */}
              {analysis.fullyCovered === 0 ? (
                <div className="flex items-start gap-2 border border-destructive/50 bg-destructive/5 text-destructive rounded p-3 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">No overlap in this window</div>
                    <div className="text-xs opacity-90">None of the {analysis.total} selected slots have all {selectedUsers.length} people available together.</div>
                  </div>
                </div>
              ) : analysis.partial > 0 || analysis.empty > 0 ? (
                <div className="flex items-start gap-2 border border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-400 rounded p-3 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Partial overlap</div>
                    <div className="text-xs opacity-90">
                      {analysis.fullyCovered}/{analysis.total} slots fully covered · {analysis.partial} partial · {analysis.empty} with no one.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 border border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 rounded p-3 text-sm">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">Full overlap across the window</div>
                    <div className="text-xs opacity-90">All {selectedUsers.length} people are available in every selected slot.</div>
                  </div>
                </div>
              )}

              {/* Grid */}
              <div className="overflow-x-auto">
                <table className="text-xs border-separate border-spacing-1 min-w-[420px]">
                  <thead>
                    <tr>
                      <th className="text-left font-medium text-muted-foreground px-2 py-1 w-20"> </th>
                      {windowDays.map((d) => (
                        <th key={d} className="text-center font-medium text-muted-foreground px-2 py-1">{d.slice(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {windowBlocks.map((b) => (
                      <tr key={b}>
                        <td className="text-left text-muted-foreground px-2 py-1">{b}</td>
                        {windowDays.map((d) => {
                          const cell = analysis.cells.find((c) => c.day === d && c.block === b)!;
                          const n = cell.available.length;
                          const total = selectedUsers.length;
                          const cls =
                            n === total ? "bg-emerald-500/70 text-white" :
                            n === 0 ? "bg-destructive/70 text-white" :
                            "bg-amber-500/60 text-white";
                          const title = n === total
                            ? `All ${total} available`
                            : n === 0
                              ? `No one available · missing: ${cell.missing.map((u) => profileMap[u]?.display_name ?? u).join(", ")}`
                              : `${n}/${total} available · missing: ${cell.missing.map((u) => profileMap[u]?.display_name ?? u).join(", ")}`;
                          return (
                            <td key={d} className="p-0">
                              <div title={title} className={`h-8 rounded text-[11px] font-medium flex items-center justify-center ${cls}`}>
                                {n}/{total}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Per-person gaps */}
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Gaps per person</div>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((uid) => {
                    const gaps = analysis.perPersonGaps[uid] ?? 0;
                    const ok = gaps === 0;
                    return (
                      <div key={uid} className={`text-[11px] px-2 py-1 rounded border ${ok ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-destructive/40 text-destructive"}`}>
                        {profileMap[uid]?.display_name ?? "Unnamed"}: {ok ? "no gaps" : `${gaps} missing slot${gaps === 1 ? "" : "s"}`}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}