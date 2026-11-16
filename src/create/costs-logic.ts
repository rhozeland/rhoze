/**
 * costs-logic.ts
 *
 * Pure budget-status logic for the manual project cost ledger.
 *
 * Rules:
 * - All money is stored and calculated as integer cents.
 * - Line-item input is converted with normal two-decimal rounding:
 *     amount_cents = Math.round(Number(input) * 100)
 * - Totals are calculated by integer addition — no floor/ceil rounding.
 * - Payment-specific floor logic stays isolated in payments-logic.ts.
 *   Do NOT import from payments-logic here.
 */

// ---------------------------------------------------------------------------
// Threshold constant (Taiga #156 — approved at 80 %)
// ---------------------------------------------------------------------------

/** Below this percentage spend is "Normal"; at or above it is "Near budget". */
export const NEAR_BUDGET_THRESHOLD_PCT = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetStatus = "no_budget" | "normal" | "near" | "over";

export interface BudgetItem {
  amount_cents: number;
}

export interface BudgetSummary {
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  /** Positive cents over budget; 0 when not over budget. */
  overCents: number;
  /** null when no budget is set. */
  progressPct: number | null;
  status: BudgetStatus;
}

// ---------------------------------------------------------------------------
// Cents helpers (Taiga #129 — rounding and edge-case defaults)
// ---------------------------------------------------------------------------

/**
 * Convert a user-typed CAD amount ("4250.00", 4250, "4250.5") to integer cents.
 * Uses normal two-decimal rounding (Math.round), NOT floor.
 * Invalid / NaN input → 0.
 */
export function amountToCents(input: string | number): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/**
 * Sum a list of line items using integer addition.
 * Returns 0 for an empty list.
 */
export function sumCosts(items: BudgetItem[]): number {
  return items.reduce((sum, item) => sum + item.amount_cents, 0);
}

/**
 * Percentage of budget spent.
 * Returns null when budgetCents <= 0 (no budget set).
 * Does NOT round — callers use formatPct for display.
 */
export function progressPct(
  spentCents: number,
  budgetCents: number
): number | null {
  if (budgetCents <= 0) return null;
  return (spentCents / budgetCents) * 100;
}

/**
 * Remaining budget in cents (negative when over budget).
 */
export function remainingCents(
  spentCents: number,
  budgetCents: number
): number {
  return budgetCents - spentCents;
}

// ---------------------------------------------------------------------------
// Status function (Taiga #155 — write the status function,
//                  Taiga #156 — threshold approved at 80 %)
// ---------------------------------------------------------------------------

/**
 * Compute the budget status for display.
 *
 * - budgetCents <= 0  → 'no_budget'  (no percentage, no status shown)
 * - pct <  80        → 'normal'
 * - pct <  100       → 'near'
 * - pct >= 100       → 'over'
 *
 * The boundary 80 % maps to 'near' (not 'normal'), matching the spec example
 * where $8,900 / $10,000 = 89 % → "Near budget".
 */
export function computeBudgetStatus(
  spentCents: number,
  budgetCents: number
): BudgetStatus {
  if (budgetCents <= 0) return "no_budget";
  const pct = progressPct(spentCents, budgetCents)!;
  if (pct < NEAR_BUDGET_THRESHOLD_PCT) return "normal";
  if (pct < 100) return "near";
  return "over";
}

// ---------------------------------------------------------------------------
// Formatters (Taiga #128 — find / extend the existing money() helper)
// ---------------------------------------------------------------------------

/**
 * Always-two-decimal CAD formatter for the cost ledger.
 * The existing shared money() drops trailing decimals on whole dollars;
 * this variant always shows cents (e.g. "$10,000.00", "$4,250.00").
 */
export function money2(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a progress percentage for display.
 * - null  → "—"   (no budget set)
 * - 42.5  → "42.5%"
 * - 89.0  → "89%"   (trailing ".0" stripped)
 * - 104.5 → "104.5%"
 */
export function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  const rounded = Math.round(pct * 10) / 10;
  const str = rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `${str}%`;
}
