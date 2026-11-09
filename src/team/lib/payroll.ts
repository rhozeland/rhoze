/**
 * Canadian payroll deduction calculator (CPP / CPP2 / EI / federal + provincial tax).
 *
 * Approach follows the CRA "T4127 – Payroll Deductions Formulas" simplified option:
 *  - Annualize the pay-period gross, apply tax brackets, subtract non-refundable
 *    credits (TD1 amounts + CPP/EI credits) at the lowest rate, then divide back
 *    down to the pay period.
 *  - CPP / EI use year-to-date amounts so annual maximums are respected.
 *
 * Every amount in/out is integer CENTS.
 */

export type TaxConfig = {
  cpp: { rate: number; rate2: number; basic_exemption: number; max_pensionable: number; max_pensionable2: number };
  ei: { rate: number; max_insurable: number; employer_multiplier: number };
  federal: { basic_personal: number; lowest_rate: number; brackets: { up_to: number | null; rate: number }[]; canada_employment?: number };
  provincial: Record<string, {
    basic_personal: number;
    lowest_rate: number;
    brackets: { up_to: number | null; rate: number }[];
    surtax?: { over: number; rate: number }[];
    /** Ontario tax reduction basic amount (dollars). Omitted → no reduction. */
    reduction_basic?: number;
    /** Ontario Health Premium on/off (defaults on for ON). */
    health_premium?: boolean;
  }>;
};

export type PayrollProfile = {
  worker_type: "employee" | "contractor" | string;
  province: string;
  pay_frequency: number;          // pay periods per year (26 = biweekly)
  td1_federal_cents: number;      // 0 → use basic personal amount
  td1_provincial_cents: number;
  cpp_exempt: boolean;
  ei_exempt: boolean;
  extra_tax_cents: number;        // additional tax requested per pay
  vacation_pay_pct: number;       // e.g. 4 → 4% of earnings
};

export type YTD = {
  gross_cents: number;
  cpp_cents: number;
  cpp2_cents: number;
  ei_cents: number;
  pensionable_cents: number;
};

export const EMPTY_YTD: YTD = { gross_cents: 0, cpp_cents: 0, cpp2_cents: 0, ei_cents: 0, pensionable_cents: 0 };

export const DEFAULT_PROFILE: PayrollProfile = {
  worker_type: "employee",
  province: "ON",
  pay_frequency: 26,
  td1_federal_cents: 0,
  td1_provincial_cents: 0,
  cpp_exempt: false,
  ei_exempt: false,
  extra_tax_cents: 0,
  vacation_pay_pct: 4,
};

export type PayrollResult = {
  earnings_cents: number;      // hourly + flat + revshare
  vacation_cents: number;
  gross_cents: number;         // earnings + vacation (taxable)
  cpp_cents: number;
  cpp2_cents: number;
  ei_cents: number;
  fed_tax_cents: number;
  prov_tax_cents: number;      // includes Ontario Health Premium
  ohp_cents: number;           // Ontario Health Premium portion of prov_tax
  deductions_cents: number;
  expense_cents: number;       // non-taxable reimbursement
  net_cents: number;
  employer_cpp_cents: number;
  employer_ei_cents: number;
};

const c = (dollars: number) => Math.round(dollars * 100);
const clampPos = (n: number) => (n > 0 ? Math.round(n) : 0);

/** Progressive tax on an annual amount in cents, using brackets stated in dollars. */
function bracketTax(annualCents: number, brackets: { up_to: number | null; rate: number }[]): number {
  let tax = 0;
  let lower = 0;
  for (const b of brackets) {
    const upper = b.up_to == null ? Infinity : c(b.up_to);
    if (annualCents <= lower) break;
    const slice = Math.min(annualCents, upper) - lower;
    if (slice > 0) tax += slice * b.rate;
    lower = upper;
    if (annualCents <= upper) break;
  }
  return tax;
}

export function calcPayroll(opts: {
  earnings_cents: number;
  expense_cents?: number;
  profile: PayrollProfile;
  ytd?: YTD;
  config: TaxConfig;
}): PayrollResult {
  const { config } = opts;
  const p = { ...DEFAULT_PROFILE, ...opts.profile };
  const ytd = { ...EMPTY_YTD, ...(opts.ytd ?? {}) };
  const expense = opts.expense_cents ?? 0;
  const earnings = Math.max(0, Math.round(opts.earnings_cents));
  const freq = p.pay_frequency > 0 ? p.pay_frequency : 26;

  // Contractors: no source deductions.
  if (p.worker_type !== "employee") {
    return {
      earnings_cents: earnings, vacation_cents: 0, gross_cents: earnings,
      cpp_cents: 0, cpp2_cents: 0, ei_cents: 0, fed_tax_cents: 0, prov_tax_cents: 0, ohp_cents: 0,
      deductions_cents: 0, expense_cents: expense, net_cents: earnings + expense,
      employer_cpp_cents: 0, employer_ei_cents: 0,
    };
  }

  const vacation = Math.round((earnings * (Number(p.vacation_pay_pct) || 0)) / 100);
  const gross = earnings + vacation;

  // ---- CPP + CPP2 -------------------------------------------------------
  let cpp = 0, cpp2 = 0;
  if (!p.cpp_exempt) {
    const maxPens = c(config.cpp.max_pensionable);
    const maxPens2 = c(config.cpp.max_pensionable2);
    const exemptionPerPeriod = Math.round(c(config.cpp.basic_exemption) / freq);

    const roomTier1 = Math.max(0, maxPens - ytd.pensionable_cents);
    const tier1Base = Math.max(0, Math.min(gross, roomTier1) - exemptionPerPeriod);
    cpp = clampPos(tier1Base * config.cpp.rate);
    const maxCppYear = Math.round((maxPens - c(config.cpp.basic_exemption)) * config.cpp.rate);
    cpp = Math.min(cpp, Math.max(0, maxCppYear - ytd.cpp_cents));

    const tier2Start = Math.max(ytd.pensionable_cents, maxPens);
    const tier2End = Math.min(ytd.pensionable_cents + gross, maxPens2);
    const tier2Base = Math.max(0, tier2End - tier2Start);
    cpp2 = clampPos(tier2Base * config.cpp.rate2);
    const maxCpp2Year = Math.round((maxPens2 - maxPens) * config.cpp.rate2);
    cpp2 = Math.min(cpp2, Math.max(0, maxCpp2Year - ytd.cpp2_cents));
  }

  // ---- EI ---------------------------------------------------------------
  let ei = 0;
  if (!p.ei_exempt) {
    const maxEiYear = Math.round(c(config.ei.max_insurable) * config.ei.rate);
    ei = Math.min(clampPos(gross * config.ei.rate), Math.max(0, maxEiYear - ytd.ei_cents));
  }

  // ---- Income tax (CRA T4127 annualized method) ----------------------
  // F5: enhanced CPP (the part above the 4.95% base rate) and all CPP2 are
  // deducted from income; only the base portion earns the K2 credit.
  const baseShare = config.cpp.rate > 0 ? Math.min(1, 0.0495 / config.cpp.rate) : 1;
  const enhancedCpp = cpp * (1 - baseShare) + cpp2;
  const annual = Math.max(0, (gross - enhancedCpp) * freq);
  const annualBaseCpp = cpp * baseShare * freq;
  const annualEi = ei * freq;

  const prov = config.provincial[p.province] ?? config.provincial.ON;

  const fedClaim = p.td1_federal_cents > 0 ? p.td1_federal_cents : c(config.federal.basic_personal);
  const cea = Math.min(gross * freq, c(config.federal.canada_employment ?? 0));
  const fedCredits = (fedClaim + annualBaseCpp + annualEi + cea) * config.federal.lowest_rate;
  const fedAnnual = Math.max(0, bracketTax(annual, config.federal.brackets) - fedCredits);

  const provClaim = p.td1_provincial_cents > 0 ? p.td1_provincial_cents : c(prov.basic_personal);
  const provCredits = (provClaim + annualBaseCpp + annualEi) * prov.lowest_rate;
  let provAnnual = Math.max(0, bracketTax(annual, prov.brackets) - provCredits);

  // Ontario-style surtax on basic provincial tax
  if (prov.surtax?.length) {
    let surtax = 0;
    for (const s of prov.surtax) {
      const over = c(s.over);
      if (provAnnual > over) surtax += (provAnnual - over) * s.rate;
    }
    provAnnual += surtax;
  }
  // Ontario tax reduction: 2 × basic amount − provincial tax, never negative
  if (prov.reduction_basic) provAnnual = Math.max(0, provAnnual - Math.max(0, 2 * c(prov.reduction_basic) - provAnnual));

  const ohpAnnual = p.province === "ON" && prov.health_premium !== false ? ontarioHealthPremium(annual) : 0;

  const fedTax = Math.round(fedAnnual / freq) + Math.round((p.extra_tax_cents || 0));
  const ohp = Math.round(ohpAnnual / freq);
  const provTax = Math.round(provAnnual / freq) + ohp;

  const deductions = cpp + cpp2 + ei + fedTax + provTax;
  const net = gross - deductions + expense;

  return {
    earnings_cents: earnings,
    vacation_cents: vacation,
    gross_cents: gross,
    cpp_cents: cpp,
    cpp2_cents: cpp2,
    ei_cents: ei,
    fed_tax_cents: fedTax,
    prov_tax_cents: provTax,
    ohp_cents: ohp,
    deductions_cents: deductions,
    expense_cents: expense,
    net_cents: net,
    employer_cpp_cents: cpp + cpp2,
    employer_ei_cents: Math.round(ei * config.ei.employer_multiplier),
  };
}

/** Ontario Health Premium on annual taxable income (cents in, cents out). */
export function ontarioHealthPremium(annualCents: number): number {
  const a = annualCents / 100;
  const step = (base: number, from: number, rate: number, cap: number) => Math.min(cap, base + rate * (a - from));
  let d = 0;
  if (a <= 20000) d = 0;
  else if (a <= 36000) d = step(0, 20000, 0.06, 300);
  else if (a <= 48000) d = step(300, 36000, 0.06, 450);
  else if (a <= 72000) d = step(450, 48000, 0.25, 600);
  else if (a <= 200000) d = step(600, 72000, 0.25, 750);
  else d = step(750, 200000, 0.25, 900);
  return Math.round(d * 100);
}

export const PROVINCES = [
  { code: "ON", name: "Ontario" },
  { code: "BC", name: "British Columbia" },
  { code: "AB", name: "Alberta" },
  { code: "QC", name: "Quebec" },
];

export const PAY_FREQUENCIES = [
  { value: 52, label: "Weekly (52)" },
  { value: 26, label: "Biweekly (26)" },
  { value: 24, label: "Semi-monthly (24)" },
  { value: 12, label: "Monthly (12)" },
];
