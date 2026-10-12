import { describe, it, expect } from "vitest";
import { passLevel, earnedBadges } from "./pass-logic";
describe("Creator OS earned progress", () => {
  it("starts at level one without earned activity", () => { expect(passLevel(0).level).toBe(1); expect(passLevel(0).progress).toBe(0); });
  it("uses Creator OS thresholds without inventing token benefits", () => { expect(passLevel(500)).toMatchObject({ level: 7, title: "Builder", next: 750, remaining: 250 }); expect(passLevel(1500).level).toBe(10); });
  it("only awards badges for completed contributions", () => { expect(earnedBadges({xp:25,contributions:1,projects:0,likes:1,applications:0,payments:0})).toEqual(["Supporter"]); });
});