import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: {
    ...mocks,
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
  } },
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("account service outages", () => {
  it("does not sign out a saved session on a temporary network failure", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "employee-test" } } } });
    mocks.getUser.mockResolvedValue({ error: { status: 0, message: "Failed to fetch" } });
    render(<AuthProvider><div>Private team page</div></AuthProvider>);
    await screen.findByRole("heading", { name: "Account service unavailable" });
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(screen.queryByText("Private team page")).toBeNull();
  });
  it("shows a retry state when session retrieval fails", async () => {
    mocks.getSession.mockRejectedValue(new Error("Network unavailable"));
    render(<AuthProvider><div>Private team page</div></AuthProvider>);
    await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByText("Private team page")).toBeNull();
  });
});