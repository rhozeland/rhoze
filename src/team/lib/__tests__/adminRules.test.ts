import { describe, expect, it } from "vitest";
import { hasTeamAccess, TEAM_ROLES, validLeaderboardPoints } from "../adminRules";
describe("real team access", () => {
  it("admits admins", () => expect(hasTeamAccess(["admin"])).toBe(true));
  it("admits employees", () => expect(hasTeamAccess(["employee"])).toBe(true));
  it("admits marketing", () => expect(hasTeamAccess(["marketing"])).toBe(true));
  it("denies clients", () => expect(hasTeamAccess(["client"])).toBe(false));
  it("denies unassigned accounts", () => expect(hasTeamAccess([])).toBe(false));
  it("offers existing roles", () => expect(TEAM_ROLES).toEqual(["admin", "employee", "marketing", "client"]));
});
describe("point corrections", () => {
  it("accepts zero", () => expect(validLeaderboardPoints(0)).toBe(true));
  it("rejects negatives", () => expect(validLeaderboardPoints(-1)).toBe(false));
  it("rejects fractions", () => expect(validLeaderboardPoints(1.5)).toBe(false));
});