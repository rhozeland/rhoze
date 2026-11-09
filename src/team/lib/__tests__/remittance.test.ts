import { describe, it, expect } from "vitest";
import { remittanceTotals, remittanceDueDate } from "../remittance";

const stub = (o: Partial<any> = {}) => ({ user_id: "a", worker_type: "employee", gross_cents: 200000, cpp_cents: 11099, cpp2_cents: 0, ei_cents: 3260, fed_tax_cents: 15000, prov_tax_cents: 7000, employer_cpp_cents: 11099, employer_ei_cents: 4564, pay_date: "2026-11-13", ...o });

describe("remittance", () => {
  it("adds employee + employer CPP and EI plus income tax", () => {
    expect(remittanceTotals([stub()]).remittance_cents).toBe(11099 + 11099 + 3260 + 4564 + 15000 + 7000);
  });
  it("ignores contractors", () => {
    expect(remittanceTotals([stub({ worker_type: "contractor" })]).remittance_cents).toBe(0);
  });
  it("is due the 15th of the following month", () => {
    expect(remittanceDueDate("2026-11")).toBe("2026-12-15");
    expect(remittanceDueDate("2026-12")).toBe("2027-01-15");
  });
});
