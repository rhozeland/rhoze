import { describe, expect, it } from "vitest";
import { IDEA_QUESTIONS, IDEA_SCREENS, FLEXIBLE_TIMELINES, PRIVATE_PROJECT_STATUS, hasOpenRoles, scopeError, validateIdeaQuestion } from "./project-flow";

describe("private project flow", () => {
  it("starts private rather than publishing", () => expect(PRIVATE_PROJECT_STATUS).toBe("draft"));
  it("keeps separate idea questions without an Artist/Brand question", () => expect(IDEA_QUESTIONS).toEqual(["title", "name", "making", "description", "audience", "location", "category", "cover"]));
  it("groups the idea into three screens", () => expect(IDEA_SCREENS.flat()).toEqual([...IDEA_QUESTIONS]));
  it("requires the project name before advancing its question", () => expect(validateIdeaQuestion("title", "")).toBe("Give your project a name."));
  it("allows an estimate without a fixed budget", () => expect(scopeError(0, true, "flexible", "1 week", "")).toBe(""));
  it("lets a portfolio share skip the budget and timeline", () => expect(scopeError(0, false, "flexible", "", "")).toBe(""));
  it("supports the requested flexible periods", () => expect(FLEXIBLE_TIMELINES.slice(0, 4)).toEqual(["1 week", "2 weeks", "1 month", "3 months"]));
  it("requires a date in exact-date mode", () => expect(scopeError(10000, false, "date", "", "")).toBe("Pick a target date."));
  it("lets any project have open roles regardless of account type", () => expect(hasOpenRoles({ makers: ["open_roles"], roles: [{ name: "Editor" }] })).toBe(true));
});