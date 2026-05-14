import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Shield, User, Briefcase, RotateCcw, Save, Lock, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Roles Settings — an admin-friendly reference + tweak surface for the
 * three app roles and the department→role allow matrix.
 *
 * The actual access enforcement lives in Postgres RLS (see has_role /
 * is_team_member). This page surfaces the human-readable description of
 * each role and lets admins customise:
 *   - the displayed label and notes for each role (localStorage)
 *   - which roles each department is allowed to grant (localStorage)
 *
 * Persisting these in localStorage keeps the existing RLS contract
 * untouched while removing the "obfuscated, hard to tweak" friction of
 * having these definitions buried in source.
 */

type Role = "admin" | "employee" | "client";
const ROLES: Role[] = ["admin", "employee", "client"];

const DEPARTMENTS = ["marketing", "hr", "development", "sales", "operations"] as const;
type Dept = (typeof DEPARTMENTS)[number];

const DEFAULT_LABELS: Record<Role, string> = {
  admin: "Admin",
  employee: "Employee",
  client: "Client",
};

const DEFAULT_NOTES: Record<Role, string> = {
  admin:
    "Full control. Can grant or revoke roles, edit any record, manage docs, projects, payments, and run privileged actions.",
  employee:
    "Internal team access. Can read team data, post messages, manage CRM contacts, deals, activities, and update assigned work.",
  client:
    "Project-scoped access only. Can view their own projects, milestones, and submit credit requests. No internal team data.",
};

const DEFAULT_PERMS: Record<Role, string[]> = {
  admin: [
    "Manage all team members and roles",
    "Create, edit, archive any project",
    "Upload admin-only docs",
    "Approve credit requests",
    "Run airdrops & adjust $RHOZE settings",
  ],
  employee: [
    "Read internal docs (by audience)",
    "Manage CRM contacts, deals, activities",
    "Post in team channels",
    "Update assigned line items & milestones",
  ],
  client: [
    "View their own project & milestones",
    "Submit credit requests",
    "Read project payments & line items",
  ],
};

const DEFAULT_MATRIX: Record<Dept, Role[]> = {
  marketing: ["employee"],
  hr: ["admin", "employee"],
  development: ["employee"],
  sales: ["employee", "client"],
  operations: ["admin", "employee"],
};

const ROLE_ICON: Record<Role, typeof Shield> = {
  admin: Shield,
  employee: Briefcase,
  client: User,
};

const STORAGE_KEY = "roleSettings.v1";

type Stored = {
  labels: Record<Role, string>;
  notes: Record<Role, string>;
  perms: Record<Role, string[]>;
  matrix: Record<Dept, Role[]>;
};

const DEFAULTS: Stored = {
  labels: DEFAULT_LABELS,
  notes: DEFAULT_NOTES,
  perms: DEFAULT_PERMS,
  matrix: DEFAULT_MATRIX,
};

function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    return {
      labels: { ...DEFAULTS.labels, ...(parsed.labels ?? {}) },
      notes: { ...DEFAULTS.notes, ...(parsed.notes ?? {}) },
      perms: { ...DEFAULTS.perms, ...(parsed.perms ?? {}) },
      matrix: { ...DEFAULTS.matrix, ...(parsed.matrix ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export default function RoleSettings() {
  const [state, setState] = useState<Stored>(() => loadStored());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state, dirty]);

  const update = (patch: Partial<Stored>) => {
    setState((s) => ({ ...s, ...patch }));
    setDirty(true);
  };

  const reset = () => {
    setState(DEFAULTS);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setDirty(false);
    toast({ title: "Reset to defaults" });
  };

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setDirty(false);
      toast({ title: "Roles settings saved" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    }
  };

  const toggleMatrix = (dept: Dept, role: Role) => {
    const current = state.matrix[dept] ?? [];
    const next = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    update({ matrix: { ...state.matrix, [dept]: next } });
  };

  const setPerms = (role: Role, lines: string) => {
    const arr = lines.split("\n").map((l) => l.trim()).filter(Boolean);
    update({ perms: { ...state.perms, [role]: arr } });
  };

  const matrixCells = useMemo(
    () =>
      DEPARTMENTS.map((d) => ({
        dept: d,
        roles: ROLES.map((r) => ({ role: r, on: (state.matrix[d] ?? []).includes(r) })),
      })),
    [state.matrix],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Roles &amp; permissions</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            One place to read what each role can do and configure the
            department → role allow list. Server-side RLS still enforces
            access — these settings keep the documentation visible and
            tweakable without digging through code.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw size={12} /> Reset
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty}>
            {dirty ? <><Save size={12} /> Save</> : <><Check size={12} /> Saved</>}
          </Button>
        </div>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ROLES.map((role) => {
          const Icon = ROLE_ICON[role];
          return (
            <div key={role} className="border border-border rounded-lg p-4 bg-card space-y-3">
              <div className="flex items-center gap-2">
                <Icon size={14} className="text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {role}
                </span>
                <Lock size={10} className="text-muted-foreground ml-auto" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Display label
                </label>
                <Input
                  value={state.labels[role]}
                  onChange={(e) =>
                    update({ labels: { ...state.labels, [role]: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Description
                </label>
                <Textarea
                  rows={3}
                  value={state.notes[role]}
                  onChange={(e) =>
                    update({ notes: { ...state.notes, [role]: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Permissions (one per line)
                </label>
                <Textarea
                  rows={5}
                  value={(state.perms[role] ?? []).join("\n")}
                  onChange={(e) => setPerms(role, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Department × role matrix */}
      <div className="border border-border rounded-lg bg-card">
        <div className="p-4 border-b border-border">
          <div className="text-sm font-medium">Department → role allow list</div>
          <div className="text-xs text-muted-foreground">
            Controls which roles a member can hold based on their department.
            Admins always retain absolute control; this is a guideline used
            in the Role manager UI.
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs border-separate border-spacing-1 min-w-[480px]">
            <thead>
              <tr>
                <th className="text-left text-muted-foreground font-medium px-2 py-1">
                  Department
                </th>
                {ROLES.map((r) => (
                  <th key={r} className="text-center text-muted-foreground font-medium px-2 py-1 capitalize">
                    {state.labels[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixCells.map(({ dept, roles }) => (
                <tr key={dept}>
                  <td className="px-2 py-1 capitalize text-foreground">{dept}</td>
                  {roles.map(({ role, on }) => (
                    <td key={role} className="p-0 text-center">
                      <button
                        type="button"
                        onClick={() => toggleMatrix(dept, role)}
                        aria-pressed={on}
                        className={
                          "w-full h-9 rounded text-[11px] font-medium transition-colors " +
                          (on
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted")
                        }
                      >
                        {on ? "Allowed" : "—"}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        Note: server-side row-level security is the source of truth for who
        can read or write what. These settings document and reorganise the
        intent in one place — they do not bypass RLS.
      </p>
    </div>
  );
}