import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ChevronDown, ChevronRight, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../lib/auth";

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

function allowedRoles(dept: Dept | null | undefined): Role[] {
  if (!dept) return UNASSIGNED_ROLES;
  return DEPT_ROLE_MATRIX[dept] ?? [];
}

function validateRoleForDept(role: Role, dept: Dept | null | undefined): string | null {
  const allowed = allowedRoles(dept);
  if (!allowed.includes(role)) {
    const deptLabel = dept ? (DEPTS.find((d) => d.value === dept)?.label ?? dept) : "Unassigned";
    return `'${role}' is not allowed in ${deptLabel}. Allowed: ${allowed.join(", ") || "none"}.`;
  }
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<Dept | "all" | "unassigned">("all");
  const [statusFilter, setStatusFilter] = useState<EmpStatus | "all">("all");
  const [tenureMin, setTenureMin] = useState<string>("");
  const [tenureMax, setTenureMax] = useState<string>("");

  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, department, job_title, employment_status, started_at, ended_at, employment_notes")
        .order("display_name");
      if (error) throw error;
      return data;
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
  }, [profiles, view, search, deptFilter, statusFilter, tenureMin, tenureMax]);

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

      <div className="flex gap-2 text-sm">
        {([
          { k: "current", label: `Current (${counts.current})` },
          { k: "former", label: `Former (${counts.former})` },
          { k: "all", label: `All (${counts.all})` },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setView(t.k)}
            className={`px-3 py-1.5 rounded border ${view === t.k ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 border border-border rounded-lg p-3 bg-card">
        <div className="flex-1 min-w-[220px]">
          <label className="text-[10px] uppercase text-muted-foreground">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-7"
              placeholder="Name, title, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="w-44">
          <label className="text-[10px] uppercase text-muted-foreground">Department</label>
          <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {DEPTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <label className="text-[10px] uppercase text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {EMP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-28">
          <label className="text-[10px] uppercase text-muted-foreground">Tenure ≥ (mo)</label>
          <Input type="number" min={0} className="h-9" value={tenureMin} onChange={(e) => setTenureMin(e.target.value)} placeholder="0" />
        </div>
        <div className="w-28">
          <label className="text-[10px] uppercase text-muted-foreground">Tenure ≤ (mo)</label>
          <Input type="number" min={0} className="h-9" value={tenureMax} onChange={(e) => setTenureMax(e.target.value)} placeholder="∞" />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X size={12} /> Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[1500px]">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-2 py-3 w-8"></th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 w-44">Department</th>
              <th className="px-4 py-3 w-56">Job title</th>
              <th className="px-4 py-3 w-40">Status</th>
              <th className="px-4 py-3 w-36">Started</th>
              <th className="px-4 py-3 w-36">Ended</th>
              <th className="px-4 py-3 w-24">Tenure</th>
              <th className="px-4 py-3 w-56">Notes</th>
              <th className="px-4 py-3">Current roles</th>
              <th className="px-4 py-3 w-72">Add role</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => {
              const cur = rolesByUser?.[p.id] ?? [];
              const titleVal = titleDrafts[p.id] ?? p.job_title ?? "";
              const notesVal = notesDrafts[p.id] ?? p.employment_notes ?? "";
              const isFormer = p.employment_status === "former";
              const isOpen = !!expanded[p.id];
              return (
                <Fragment key={p.id}>
                <tr className={`border-t border-border align-top ${isFormer ? "opacity-70" : ""}`}>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => setExpanded({ ...expanded, [p.id]: !isOpen })}
                      className="text-muted-foreground hover:text-foreground"
                      title={isOpen ? "Collapse history" : "Expand history"}
                    >
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.id.slice(0, 8)}…</div>
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      className="h-9"
                      placeholder="e.g. Lead Designer"
                      value={titleVal}
                      onChange={(e) => setTitleDrafts({ ...titleDrafts, [p.id]: e.target.value })}
                      onBlur={() => {
                        const next = (titleDrafts[p.id] ?? "").trim();
                        if (next !== (p.job_title ?? "")) {
                          setTitle.mutate({ userId: p.id, job_title: next || null });
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={p.employment_status ?? "active"}
                      onValueChange={(v) => setEmp.mutate({ userId: p.id, patch: { employment_status: v } })}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EMP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="date"
                      className="h-9"
                      value={p.started_at ?? ""}
                      onChange={(e) => setEmp.mutate({ userId: p.id, patch: { started_at: e.target.value || null } })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="date"
                      className="h-9"
                      value={p.ended_at ?? ""}
                      onChange={(e) => setEmp.mutate({ userId: p.id, patch: { ended_at: e.target.value || null } })}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{tenure(p.started_at, p.ended_at)}</td>
                  <td className="px-4 py-3">
                    <Input
                      className="h-9"
                      placeholder="e.g. promoted Q2, left amicably"
                      value={notesVal}
                      onChange={(e) => setNotesDrafts({ ...notesDrafts, [p.id]: e.target.value })}
                      onBlur={() => {
                        const next = (notesDrafts[p.id] ?? "").trim();
                        if (next !== (p.employment_notes ?? "")) {
                          setEmp.mutate({ userId: p.id, patch: { employment_notes: next || null } });
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {cur.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                      {cur.map((r) => {
                        const invalid = !allowedRoles(p.department as Dept | null).includes(r.role);
                        return (
                          <span
                            key={r.id}
                            title={invalid ? `'${r.role}' is not allowed in this department` : undefined}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                              invalid
                                ? "bg-destructive/10 text-destructive border border-destructive/40"
                                : "bg-muted"
                            }`}
                          >
                            {r.role}
                            {invalid && <span className="text-[10px] uppercase">invalid</span>}
                            <button onClick={() => revoke.mutate(r.id)} className="hover:text-destructive"><Trash2 size={12} /></button>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const dept = (p.department ?? null) as Dept | null;
                      const allowed = allowedRoles(dept);
                      const pick = picks[p.id] ?? allowed[0] ?? "employee";
                      const err = errors[p.id] ?? validateRoleForDept(pick as Role, dept);
                      const hasAllowed = allowed.length > 0;
                      return (
                        <div className="space-y-1">
                          <div className="flex gap-2">
                            <Select
                              value={pick}
                              onValueChange={(v) => {
                                setPicks({ ...picks, [p.id]: v as Role });
                                setErrors({ ...errors, [p.id]: validateRoleForDept(v as Role, dept) });
                              }}
                            >
                              <SelectTrigger className={`h-9 ${err ? "border-destructive" : ""}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => {
                                  const disabled = !allowed.includes(r);
                                  return (
                                    <SelectItem key={r} value={r} disabled={disabled}>
                                      {r}{disabled ? " — not allowed" : ""}
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              disabled={!!err || !hasAllowed}
                              onClick={() => {
                                const v = validateRoleForDept(pick as Role, dept);
                                if (v) {
                                  setErrors({ ...errors, [p.id]: v });
                                  toast({ title: "Role not allowed", description: v, variant: "destructive" });
                                  return;
                                }
                                grant.mutate({ userId: p.id, role: pick as Role });
                              }}
                            >
                              Add
                            </Button>
                          </div>
                          {err && <div className="text-[11px] text-destructive">{err}</div>}
                          {!err && (
                            <div className="text-[10px] text-muted-foreground">
                              Allowed: {allowed.join(", ") || "none"}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-border bg-muted/10">
                    <td colSpan={11} className="p-0">
                      <MastersheetPanel userId={p.id} />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
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
  const { data: profile, isLoading } = useQuery({
    queryKey: ["mastersheet", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("phone, address, date_of_birth, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, wage, payment_method, work_type, stage_name, program, internal_notes")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [draft, setDraft] = useState<Record<string, string>>({});
  const val = (k: string) => draft[k] ?? (profile as any)?.[k] ?? "";

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = {};
      Object.keys(draft).forEach((k) => { patch[k] = draft[k] === "" ? null : draft[k]; });
      if (Object.keys(patch).length === 0) return;
      const { error } = await supabase.from("profiles").update(patch as any).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mastersheet saved" });
      setDraft({});
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

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
      <section className="border border-border rounded p-3 bg-background space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Contact</div>
        <Field label="Phone"><Input className="h-8" value={val("phone")} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
        <Field label="Address"><Textarea rows={2} value={val("address")} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
        <Field label="Date of birth"><Input type="date" className="h-8" value={val("date_of_birth")} onChange={(e) => setDraft({ ...draft, date_of_birth: e.target.value })} /></Field>
        <Field label="Stage name"><Input className="h-8" value={val("stage_name")} onChange={(e) => setDraft({ ...draft, stage_name: e.target.value })} /></Field>
      </section>

      <section className="border border-border rounded p-3 bg-background space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Emergency contact</div>
        <Field label="Name"><Input className="h-8" value={val("emergency_contact_name")} onChange={(e) => setDraft({ ...draft, emergency_contact_name: e.target.value })} /></Field>
        <Field label="Relation"><Input className="h-8" placeholder="Mother, Sibling…" value={val("emergency_contact_relation")} onChange={(e) => setDraft({ ...draft, emergency_contact_relation: e.target.value })} /></Field>
        <Field label="Phone"><Input className="h-8" value={val("emergency_contact_phone")} onChange={(e) => setDraft({ ...draft, emergency_contact_phone: e.target.value })} /></Field>

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
        <Field label="Wage"><Input className="h-8" placeholder="$19.50/hour, Equity…" value={val("wage")} onChange={(e) => setDraft({ ...draft, wage: e.target.value })} /></Field>
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

      <section className="lg:col-span-3 border border-border rounded p-3 bg-background">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Availability {isAdmin ? "(admin override)" : "(read-only — user edits in Settings)"}
          </div>
          {isAdmin && avail && (
            <button
              type="button"
              onClick={() => clearAvail.mutate()}
              className="text-[10px] text-muted-foreground hover:text-destructive"
            >
              Clear
            </button>
          )}
        </div>

        {!isAdmin ? (
          !avail || ((avail.days ?? []).length === 0 && (avail.time_blocks ?? []).length === 0 && !avail.notes) ? (
            <div className="text-xs text-muted-foreground">No availability set.</div>
          ) : (
            <div className="text-xs space-y-1">
              <div><span className="text-muted-foreground">Days:</span> {(avail.days ?? []).join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Time of day:</span> {(avail.time_blocks ?? []).join(", ") || "—"}</div>
              {avail.notes && <div><span className="text-muted-foreground">Notes:</span> {avail.notes}</div>}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Days</div>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const on = currentAvail.days.includes(d);
                  return (
                    <button key={d} type="button"
                      onClick={() => setAvailDraft({ ...currentAvail, days: toggle(currentAvail.days, d) })}
                      className={`px-2 py-0.5 rounded text-[11px] border ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>
                      {d.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Time of day</div>
              <div className="flex flex-wrap gap-1.5">
                {TIME_BLOCKS.map((t) => {
                  const on = currentAvail.time_blocks.includes(t);
                  return (
                    <button key={t} type="button"
                      onClick={() => setAvailDraft({ ...currentAvail, time_blocks: toggle(currentAvail.time_blocks, t) })}
                      className={`px-2 py-0.5 rounded text-[11px] border ${on ? "bg-foreground text-background border-foreground" : "border-border hover:bg-muted"}`}>
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Notes">
              <Textarea rows={2} value={currentAvail.notes}
                onChange={(e) => setAvailDraft({ ...currentAvail, notes: e.target.value })} />
            </Field>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" disabled={!availDraft || saveAvail.isPending}
                onClick={() => saveAvail.mutate()}>
                {saveAvail.isPending ? "Saving…" : availDraft ? "Save availability" : "Saved"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <div className="lg:col-span-3 flex justify-end">
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : dirty ? "Save mastersheet" : "Saved"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}