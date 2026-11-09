/**
 * Source-deduction remittance (CRA PD7A-style) totals from pay stubs.
 * Remittance due = employee CPP + CPP2 + employer CPP + employee EI + employer EI + income tax.
 * Grouped by the month the pay was issued (CRA remits by pay date). Amounts in cents.
 */
export type RemitStub = {
  user_id: string; worker_type: string; gross_cents: number;
  cpp_cents: number; cpp2_cents: number; ei_cents: number;
  fed_tax_cents: number; prov_tax_cents: number;
  employer_cpp_cents: number; employer_ei_cents: number;
  pay_date: string;
};

export type RemitTotals = {
  gross_cents: number; cpp_employee_cents: number; cpp_employer_cents: number;
  ei_employee_cents: number; ei_employer_cents: number; tax_cents: number;
  remittance_cents: number; employees: number;
};

export const emptyTotals = (): RemitTotals => ({ gross_cents: 0, cpp_employee_cents: 0, cpp_employer_cents: 0, ei_employee_cents: 0, ei_employer_cents: 0, tax_cents: 0, remittance_cents: 0, employees: 0 });

export function remittanceTotals(stubs: RemitStub[]): RemitTotals {
  const t = emptyTotals();
  const people = new Set<string>();
  for (const s of stubs) {
    if (s.worker_type !== "employee") continue;
    people.add(s.user_id);
    t.gross_cents += s.gross_cents || 0;
    t.cpp_employee_cents += (s.cpp_cents || 0) + (s.cpp2_cents || 0);
    t.cpp_employer_cents += s.employer_cpp_cents || 0;
    t.ei_employee_cents += s.ei_cents || 0;
    t.ei_employer_cents += s.employer_ei_cents || 0;
    t.tax_cents += (s.fed_tax_cents || 0) + (s.prov_tax_cents || 0);
  }
  t.remittance_cents = t.cpp_employee_cents + t.cpp_employer_cents + t.ei_employee_cents + t.ei_employer_cents + t.tax_cents;
  t.employees = people.size;
  return t;
}

/** Month key "YYYY-MM" of the pay date. */
export const monthKey = (d: string) => d.slice(0, 7);

/** CRA regular remitter due date: 15th of the month after pay was issued. */
export function remittanceDueDate(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y; const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-15`;
}
