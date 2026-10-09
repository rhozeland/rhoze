import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MessagesInbox from "./MessagesInbox";

const state = vi.hoisted(() => ({ threads: [] as any[], applications: [] as any[], messages: [] as any[], rpc: vi.fn(), sent: [] as any[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let thread: string | undefined; let inserted: any;
    const chain: any = {
      select: () => chain, order: () => chain, in: () => chain, range: () => chain,
      eq: (_field: string, id: string) => { thread = id; return chain; },
      insert: (data: any) => { inserted = data; state.sent.push(data); return chain; },
      single: async () => { const m = { ...inserted, id: "sent", created_at: new Date().toISOString() }; state.messages.push(m); return { data: m, error: null }; },
      then: (resolve: any) => Promise.resolve({ data: table === "dm_threads" ? state.threads : table === "dm_messages" ? state.messages.filter(m => !thread || m.thread_id === thread) : [], error: null }).then(resolve),
    }; return chain;
  },
  rpc: (name: string, args: any) => { state.rpc(name, args); return Promise.resolve({ data: name === "my_application_inbox" ? state.applications : "chat", error: null }); },
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: vi.fn(),
} }));

const application = { id: "mine", release_id: "project", role_name: "Video editor", role_index: 0, name: "Alex", link: "https://example.com", description: "I can edit the launch film.", files: [{ name: "Portfolio.pdf", url: "https://example.com/portfolio.pdf" }], status: "applied", created_at: "2026-10-09T12:00:00Z", updated_at: "2026-10-09T12:00:00Z", project_title: "Launch film", project_slug: "launch-film", brand_name: "Studio", is_owner: false, applicant_user_id: "me", profile_slug: null, photo_url: null, skills: [] };

beforeEach(() => {
  localStorage.clear(); history.replaceState(null, "", "/messages");
  Element.prototype.scrollIntoView = vi.fn();
  state.rpc.mockClear(); state.sent = [];
  state.threads = [{ id: "chat", starter_id: "me", owner_id: "other", profile_kind: "creator", profile_slug: "alex", profile_name: "Alex", personal_started: true, last_at: "2026-10-09T12:00:00Z" }, { id: "application-only", starter_id: "me", owner_id: "brand", profile_kind: "brand", profile_slug: "brand", profile_name: "Application-only Brand", personal_started: false, last_at: "2026-10-09T12:00:00Z" }];
  state.messages = [{ id: "m1", thread_id: "chat", sender_id: "other", body: "Hello Alex", created_at: "2026-10-09T12:00:00Z" }, { id: "m2", thread_id: "application-only", sender_id: "me", body: "Application: Editor on Launch film\nName: Alex\nDescription: Hello", created_at: "2026-10-09T12:00:00Z" }];
  state.applications = [application, { ...application, id: "received", name: "Jordan", applicant_user_id: "jordan", is_owner: true, skills: ["Editing"], profile_slug: "jordan" }];
});
afterEach(cleanup);

describe("Messages inbox", () => {
  it("separates application-only threads and sends a personal message", async () => {
    render(<MessagesInbox uid="me" />);
    const chat = await screen.findByRole("button", { name: "Alex, unread" });
    expect(screen.queryByText("Application-only Brand")).not.toBeInTheDocument();
    fireEvent.click(chat);
    await screen.findByText("Hello Alex");
    fireEvent.change(screen.getByRole("textbox", { name: "Write a message" }), { target: { value: "Let's collaborate" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await screen.findByText("Let's collaborate");
    expect(state.sent[0]).toEqual({ thread_id: "chat", sender_id: "me", body: "Let's collaborate" });
  });
  it("shows personal application details, attachment and status", async () => {
    render(<MessagesInbox uid="me" />);
    await screen.findByRole("button", { name: "Alex, unread" });
    fireEvent.click(screen.getByRole("tab", { name: /My Applications/ }));
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    await screen.findByRole("dialog");
    expect(screen.getByText("I can edit the launch film.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Portfolio.pdf ↗" })).toHaveAttribute("href", "https://example.com/portfolio.pdf");
    expect(screen.queryByRole("button", { name: "Accept application" })).not.toBeInTheDocument();
  });
  it("groups applicants and uses the existing owner-only acceptance action", async () => {
    render(<MessagesInbox uid="me" />);
    await screen.findByRole("button", { name: "Alex, unread" });
    fireEvent.click(screen.getByRole("tab", { name: /Applicants/ }));
    expect(screen.getByText("Jordan")).toBeInTheDocument();
    expect(screen.getByText("Editing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View profile" })).toHaveAttribute("href", "/creator/jordan");
    fireEvent.click(screen.getByRole("button", { name: "Review application" }));
    fireEvent.click(screen.getByRole("button", { name: "Accept application" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("release_set_application_status", { p_token: null, p_app_id: "received", p_status: "hired" }));
  });
  it("shows useful empty states with an open-roles link", async () => {
    state.threads = []; state.messages = []; state.applications = [];
    render(<MessagesInbox uid="me" />);
    await screen.findByText("No conversations yet");
    fireEvent.click(screen.getByRole("tab", { name: /My Applications/ }));
    expect(screen.getByRole("link", { name: "Browse open roles" })).toHaveAttribute("href", "/community.html?view=open-calls");
    fireEvent.click(screen.getByRole("tab", { name: /Applicants/ }));
    expect(screen.getByText("No applicants yet")).toBeInTheDocument();
  });
});