import { describe, expect, it, vi } from "vitest";
import { completeDraftHandoff } from "./draft-handoff";

describe("Save draft account handoff", () => {
  it("claims the private draft before reading it back and opening the profile", async () => {
    const order: string[] = [];
    const path = await completeDraftHandoff("draft-1", {
      claim: async () => { order.push("claim"); },
      saveTeam: async () => { order.push("team"); },
      list: async () => { order.push("list"); return [{ id: "draft-1", status: "draft" }]; },
    });
    expect(order).toEqual(["claim", "team", "list"]);
    expect(path).toBe("/me?drafts=1&saved=1");
  });
  it("does not leave the page if account ownership cannot be claimed", async () => {
    const list = vi.fn();
    await expect(completeDraftHandoff("draft-1", { claim: async () => { throw new Error("Denied"); }, saveTeam: vi.fn(), list })).rejects.toThrow("Denied");
    expect(list).not.toHaveBeenCalled();
  });
  it("requires the saved private draft to appear in the owner's list", async () => {
    await expect(completeDraftHandoff("draft-1", { claim: async () => {}, saveTeam: async () => {}, list: async () => [{ id: "another", status: "draft" }] })).rejects.toThrow("hasn't appeared");
  });
});