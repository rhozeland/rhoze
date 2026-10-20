import { describe, expect, it } from "vitest";
import { portalDestination } from "../portalRouting";

describe("shared account portal routing", () => {
  it("sends employee entry to the team dashboard", () => {
    expect(portalDestination(["employee"], "team")).toBe("/");
  });
  it("sends marketing entry to the team dashboard", () => {
    expect(portalDestination(["marketing"], "team")).toBe("/");
  });
  it("does not silently send a denied team entry to the client portal", () => {
    expect(portalDestination(["client"], "team")).toBeNull();
  });
  it("keeps explicit client entry for dual-role accounts", () => {
    expect(portalDestination(["admin", "client"], "client")).toBe("/client/home");
  });
  it("lets dual-role accounts choose when there is no intent", () => {
    expect(portalDestination(["employee", "client"], null)).toBeNull();
  });
  it("routes an existing employee without requiring a second account", () => {
    expect(portalDestination(["employee"], null)).toBe("/");
  });
});