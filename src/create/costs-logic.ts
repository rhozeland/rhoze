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
