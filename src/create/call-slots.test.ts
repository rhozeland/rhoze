import { describe, it, expect } from "vitest";
import { slotsForDay, canPayWithCredits } from "./call-slots";

const now = new Date("2026-10-20T12:00:00Z");
describe("project call slots", () => {
  it("offers 20-minute weekday slots inside the ET windows", () => {
    const s = slotsForDay("2026-10-22", [], now); // Thursday
    expect(s[0].toISOString()).toBe("2026-10-22T13:30:00.000Z"); // 9:30 ET
    expect(s.length).toBe(4 + 10);
  });
  it("hides slots under 24 hours notice", () => {
    expect(slotsForDay("2026-10-20", [], now).length).toBe(0);
  });
  it("hides booked slots", () => {
    expect(slotsForDay("2026-10-22", ["2026-10-22T13:30:00Z"], now)[0].toISOString()).toBe("2026-10-22T13:50:00.000Z");
  });
  it("requires enough credits to pay", () => {
    expect(canPayWithCredits(0, 1)).toBe(false);
    expect(canPayWithCredits(1, 1)).toBe(true);
  });
});
