import { describe, it, expect, vi } from "vitest";
import { validateDocForm, type DocFormInput } from "../validateDocForm";

const VALID_UUID_A = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_B = "22222222-2222-4222-8222-222222222222";

const baseForm: DocFormInput = {
  title: "Onboarding handbook",
  audience: "all",
  department: "",
  target_user_id: "",
  file_url: "",
  file: null,
};

const adminCtx = (overrides = {}) => ({
  isAdmin: true,
  userId: "admin-id",
  lookupProfile: vi.fn(async (id: string) =>
    id === VALID_UUID_A ? { id, department: "marketing" } : null,
  ),
  ...overrides,
});

describe("validateDocForm — authorization", () => {
  it("rejects unauthenticated callers", async () => {
    const r = await validateDocForm(baseForm, { isAdmin: true, userId: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors._form).toMatch(/signed in/i);
  });

  it("rejects non-admins", async () => {
    const r = await validateDocForm(baseForm, { isAdmin: false, userId: "u1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors._form).toMatch(/admins/i);
  });

  it("accepts an admin posting to everyone", async () => {
    const r = await validateDocForm(baseForm, adminCtx());
    expect(r.ok).toBe(true);
  });
});

describe("validateDocForm — audience targeting", () => {
  it("requires a department when audience=department", async () => {
    const r = await validateDocForm({ ...baseForm, audience: "department" }, adminCtx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.department).toMatch(/department/i);
  });

  it("requires a target user when audience=user", async () => {
    const r = await validateDocForm({ ...baseForm, audience: "user" }, adminCtx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.target_user_id).toMatch(/employee/i);
  });

  it("rejects when the target user does not exist", async () => {
    const ctx = adminCtx();
    const r = await validateDocForm(
      { ...baseForm, audience: "user", target_user_id: VALID_UUID_B },
      ctx,
    );
    expect(ctx.lookupProfile).toHaveBeenCalledWith(VALID_UUID_B);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.target_user_id).toMatch(/not found/i);
  });

  it("rejects when the target user is outside the chosen department", async () => {
    const r = await validateDocForm(
      {
        ...baseForm,
        audience: "user",
        department: "hr",
        target_user_id: VALID_UUID_A, // lookup says marketing
      },
      adminCtx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.target_user_id).toMatch(/hr/);
  });

  it("accepts a valid target user inside the chosen department", async () => {
    const r = await validateDocForm(
      {
        ...baseForm,
        audience: "user",
        department: "marketing",
        target_user_id: VALID_UUID_A,
      },
      adminCtx(),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects an invalid uuid for target_user_id", async () => {
    const r = await validateDocForm(
      { ...baseForm, audience: "user", target_user_id: "not-a-uuid" },
      adminCtx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.target_user_id).toBeTruthy();
  });
});

describe("validateDocForm — file & url checks", () => {
  it("rejects empty title", async () => {
    const r = await validateDocForm({ ...baseForm, title: "   " }, adminCtx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.title).toBeTruthy();
  });

  it("rejects an unsupported file type", async () => {
    const r = await validateDocForm(
      { ...baseForm, file: { name: "x.exe", type: "application/x-msdownload", size: 10 } },
      adminCtx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.file).toMatch(/unsupported/i);
  });

  it("rejects files over 500 MB", async () => {
    const r = await validateDocForm(
      { ...baseForm, file: { name: "big.pdf", type: "application/pdf", size: 600 * 1024 * 1024 } },
      adminCtx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.file).toMatch(/500 MB/);
  });

  it("accepts pdf, markdown by extension, image, and video", async () => {
    for (const f of [
      { name: "h.pdf", type: "application/pdf", size: 100 },
      { name: "h.md", type: "", size: 100 },
      { name: "p.png", type: "image/png", size: 100 },
      { name: "v.mp4", type: "video/mp4", size: 100 },
    ]) {
      const r = await validateDocForm({ ...baseForm, file: f }, adminCtx());
      expect(r.ok, `${f.name}`).toBe(true);
    }
  });

  it("rejects an invalid file_url", async () => {
    const r = await validateDocForm({ ...baseForm, file_url: "not a url" }, adminCtx());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.file_url).toBeTruthy();
  });

  it("accepts an empty file_url", async () => {
    const r = await validateDocForm({ ...baseForm, file_url: "" }, adminCtx());
    expect(r.ok).toBe(true);
  });
});