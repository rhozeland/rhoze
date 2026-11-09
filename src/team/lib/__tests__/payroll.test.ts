import { describe, it, expect } from "vitest";
import { calcPayroll, ontarioHealthPremium, DEFAULT_PROFILE, type TaxConfig } from "../payroll";

const config: TaxConfig = {
  cpp: { rate: 0.0595, rate2: 0.04, basic_exemption: 3500, max_pensionable: 74600, max_pensionable2: 85000 },
  ei: { rate: 0.0163, max_insurable: 68500, employer_multiplier: 1.4 },
  federal: { basic_personal: 16800, lowest_rate: 0.145, canada_employment: 1471, brackets: [{ up_to: 58375, rate: 0.145 }, { up_to: null, rate: 0.205 }] },
  provincial: { ON: { basic_personal: 12900, lowest_rate: 0.0505, brackets: [{ up_to: 53800, rate: 0.0505 }, { up_to: null, rate: 0.0915 }] } },
};

describe("Ontario Health Premium", () => {
  it("is zero up to $20,000", () => expect(ontarioHealthPremium(2_000_000)).toBe(0));
  it("is 6% over $20,000 below the $300 cap", () => expect(ontarioHealthPremium(2_200_000)).toBe(12_000));
  it("caps at $750 between $72,600 and $200,000", () => expect(ontarioHealthPremium(10_000_000)).toBe(75_000));
  it("caps at $900 above $200,600", () => expect(ontarioHealthPremium(30_000_000)).toBe(90_000));
});

describe("calcPayroll", () => {
  const profile = { ...DEFAULT_PROFILE, vacation_pay_pct: 0 };
  it("withholds CPP net of the per-period basic exemption", () => {
    const r = calcPayroll({ earnings_cents: 200_000, profile, config });
    expect(r.cpp_cents).toBe(Math.round((200_000 - Math.round(350_000 / 26)) * 0.0595));
  });
  it("withholds EI at the employee rate and employer pays 1.4x", () => {
    const r = calcPayroll({ earnings_cents: 200_000, profile, config });
    expect(r.ei_cents).toBe(3_260);
    expect(r.employer_ei_cents).toBe(4_564);
  });
  it("stops CPP once the annual maximum is reached", () => {
    const max = Math.round((7_460_000 - 350_000) * 0.0595);
    const r = calcPayroll({ earnings_cents: 200_000, profile, config, ytd: { gross_cents: 7_460_000, cpp_cents: max, cpp2_cents: 0, ei_cents: 0, pensionable_cents: 7_460_000 } });
    expect(r.cpp_cents).toBe(0);
  });
  it("withholds nothing for contractors", () => {
    const r = calcPayroll({ earnings_cents: 200_000, profile: { ...profile, worker_type: "contractor" }, config });
    expect(r.net_cents).toBe(200_000);
  });
  it("net pay equals gross minus every deduction", () => {
    const r = calcPayroll({ earnings_cents: 300_000, profile, config });
    expect(r.net_cents).toBe(r.gross_cents - r.cpp_cents - r.cpp2_cents - r.ei_cents - r.fed_tax_cents - r.prov_tax_cents);
  });
});
