import { describe, it, expect } from "vitest";
import { formatRhoze, rewardEntryLabel, REWARD_AMOUNTS } from "./Rewards";

describe("formatRhoze", () => {
  it("formats zero", () => {
    expect(formatRhoze(0)).toBe("0 $RHOZE");
  });
  it("formats a plain amount", () => {
    expect(formatRhoze(500)).toBe("500 $RHOZE");
  });
  it("adds thousands separators", () => {
    expect(formatRhoze(1234567)).toBe("1,234,567 $RHOZE");
  });
  it("treats null/undefined as zero", () => {
    expect(formatRhoze(null)).toBe("0 $RHOZE");
    expect(formatRhoze(undefined)).toBe("0 $RHOZE");
  });
});

describe("rewardEntryLabel", () => {
  it("prefers an explicit reason", () => {
    expect(rewardEntryLabel({ kind: "project_like", reason: "Liked a project" })).toBe("Liked a project");
  });
  it("falls back to a label for the kind", () => {
    expect(rewardEntryLabel({ kind: "release_published", reason: null })).toBe("Release published");
  });
  it("falls back to the raw kind when unknown", () => {
    expect(rewardEntryLabel({ kind: "mystery_kind", reason: null })).toBe("mystery_kind");
  });
});

describe("REWARD_AMOUNTS", () => {
  it("matches the documented amounts", () => {
    expect(REWARD_AMOUNTS.release_published).toBe(500);
    expect(REWARD_AMOUNTS.project_like).toBe(25);
    expect(REWARD_AMOUNTS.role_application).toBe(100);
  });
});
