import { describe, it, expect } from "vitest";
import { payoutPreview, buildIcs } from "./payments-logic";

describe("milestone payouts", () => {
  it("takes Rhozeland's fee before splitting", () => {
    expect(payoutPreview(100000, 10, 50)).toBe(45000);
  });
  it("calendar end date is the day after the due date", () => {
    expect(buildIcs("P", [{ id: "a", title: "Mix", position: 0, due_date: "2026-10-31" }])).toContain("DTEND;VALUE=DATE:20261101");
  });
});
