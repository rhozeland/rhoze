/**
 * Department-based section access for the team portal.
 *
 * Admins always see everything. Everyone else only sees the sections their
 * department needs — e.g. CRM is a marketing/sales surface, Time & Pay is
 * HR/operations. Admins can override per-person from Team Members →
 * Roles Settings (stored under `sectionAccess.v1`).
 *
 * This is a navigation/UX layer. Data-level enforcement still lives in RLS.
 */
export type Dept = "marketing" | "hr" | "development" | "sales" | "operations";

export const DEPT_LABELS: Record<Dept, string> = {
  marketing: "Marketing",
  hr: "HR",
  development: "Development",
  sales: "Sales",
  operations: "Operations",
};

/** Sections every team member can reach regardless of department. */
export const OPEN_SECTIONS = ["/", "/settings", "/directory", "/docs", "/projects"];

/** Section path → departments allowed. Missing key ⇒ admin only. */
export const DEFAULT_SECTION_ACCESS: Record<string, Dept[]> = {
  "/time": ["hr", "operations"],
  "/crm": ["marketing", "sales"],
  "/leaderboard": ["marketing"],
  "/live-editor": ["marketing"],
  "/newsroom": ["marketing"],
};

const STORAGE_KEY = "sectionAccess.v1";

export function loadSectionAccess(): Record<string, Dept[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECTION_ACCESS;
    return { ...DEFAULT_SECTION_ACCESS, ...(JSON.parse(raw) as Record<string, Dept[]>) };
  } catch {
    return DEFAULT_SECTION_ACCESS;
  }
}

export function saveSectionAccess(map: Record<string, Dept[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function resetSectionAccess() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function canAccessSection(
  path: string,
  opts: { isAdmin: boolean; department: Dept | null },
  map: Record<string, Dept[]> = loadSectionAccess(),
): boolean {
  if (opts.isAdmin) return true;
  if (OPEN_SECTIONS.includes(path)) return true;
  const allowed = map[path];
  if (!allowed) return false; // admin-only section
  return !!opts.department && allowed.includes(opts.department);
}
