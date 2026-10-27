import { describe, expect, it } from "vitest";
import { IDEA_QUESTIONS, IDEA_SCREENS, FLEXIBLE_TIMELINES, PRIVATE_PROJECT_STATUS, hasOpenRoles, scopeError, validateIdeaQuestion } from "./project-flow";

describe("private project flow", () => {
  it("starts private rather than publishing", () => expect(PRIVATE_PROJECT_STATUS).toBe("draft"));
  it("keeps separate idea questions without an Artist/Brand question", () => expect(IDEA_QUESTIONS).toEqual(["title", "name", "making", "description", "audience", "location", "category", "cover"]));
  it("puts the goal first and every basic on one screen", () => { expect(IDEA_SCREENS[0]).toEqual(["goal"]); expect(IDEA_SCREENS[1]).toEqual([...IDEA_QUESTIONS]); });
  it("requires the project name before advancing its question", () => expect(validateIdeaQuestion("title", "")).toBe("Give your project a name."));
  it("allows an estimate without a fixed budget", () => expect(scopeError(0, true, "flexible", "1 week", "")).toBe(""));
  it("lets a portfolio share skip the budget and timeline", () => expect(scopeError(0, false, "flexible", "", "")).toBe(""));
  it("supports the requested flexible periods", () => expect(FLEXIBLE_TIMELINES.slice(0, 4)).toEqual(["1 week", "2 weeks", "1 month", "3 months"]));
  it("requires a date in exact-date mode", () => expect(scopeError(10000, false, "date", "", "")).toBe("Pick a target date."));
  it("lets any project have open roles regardless of account type", () => expect(hasOpenRoles({ makers: ["open_roles"], roles: [{ name: "Editor" }] })).toBe(true));
});import { flowForGoal, goalDefaults } from "./project-flow";
describe("project goals", () => {
  it("skips booking a call when only sharing", () => expect(flowForGoal("share")).not.toContain("call"));
  it("skips booking a call for a project that already has a coin", () => expect(flowForGoal("coin_existing")).not.toContain("call"));
  it("offers a call when booking Rhozeland", () => expect(flowForGoal("book")).toContain("call"));
  it("preselects pasting a coin for existing coins", () => expect(goalDefaults("coin_existing").coin).toBe("own"));
  it("preselects a Rhozeland coin launch", () => expect(goalDefaults("coin_launch")).toEqual({ coin: "rhozeland", rhozeland: true }));
});
