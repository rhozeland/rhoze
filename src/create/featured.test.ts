import { describe, it, expect } from "vitest";
import { aboutError, contentError, STATUS_LABELS } from "./featured";
const ok = { name: "A", description: "d", instagram: "@a", website: "", main_link: "https://x.com", extra_links: [], pitch: "p" };
const c = { primary: true, supporting: 0, video: "", ownership: true, promotion: true };
describe("get featured rules", () => {
  it("accepts a complete about step with optional fields blank", () => expect(aboutError(ok)).toBeNull());
  it("requires the main link to be a real link", () => expect(aboutError({ ...ok, main_link: "x" })).not.toBeNull());
  it("requires a primary image", () => expect(contentError({ ...c, primary: false })).toBe("Add a primary image."));
  it("allows at most five supporting images", () => { expect(contentError({ ...c, supporting: 5 })).toBeNull(); expect(contentError({ ...c, supporting: 6 })).not.toBeNull(); });
  it("requires both permissions", () => expect(contentError({ ...c, promotion: false })).not.toBeNull());
  it("keeps approval and publication as separate statuses", () => expect(STATUS_LABELS.approved).not.toBe(STATUS_LABELS.published));
});
