import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LikedProjects, ProjectHeart } from "./ProjectLikes";

const state = vi.hoisted(() => ({ viewer: "owner" as string | null, liked: false, public: false, writes: [] as any[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: state.viewer ? { user: { id: state.viewer } } : null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from: (table: string) => {
    let detail = false;
    const chain: any = {
      select: (value: string) => { detail = value.includes("releases("); return chain; }, eq: () => chain, order: () => chain,
      maybeSingle: async () => ({ data: table === "project_like_preferences" ? (state.viewer === "owner" || state.public ? { is_public: state.public } : null) : state.liked ? { release_id: "project" } : null }),
      insert: async (value: any) => { state.liked = true; state.writes.push(value); return { error: null }; },
      delete: () => { state.liked = false; return chain; },
      upsert: async (value: any) => { state.public = value.is_public; state.writes.push(value); return { error: null }; },
      then: (resolve: any) => Promise.resolve({ error: null, data: detail && state.liked && (state.viewer === "owner" || state.public) ? [{ releases: { id: "project", slug: "winter", title: "Winter", creator_name: "Kage" } }] : [] }).then(resolve),
    }; return chain;
  },
} }));
vi.mock("./AuthModal", () => ({ default: () => <div>Sign in to like</div> }));
beforeEach(() => { state.viewer = "owner"; state.liked = false; state.public = false; state.writes = []; });
afterEach(cleanup);
describe("Project likes", () => {
  it("persists like and unlike", async () => {
    render(<ProjectHeart releaseId="project" />);
    fireEvent.click(await screen.findByRole("button", { name: "Like project" }));
    fireEvent.click(await screen.findByRole("button", { name: "Unlike project" }));
    await screen.findByRole("button", { name: "Like project" });
    expect(state.writes[0]).toEqual({ user_id: "owner", release_id: "project" });
    expect(state.liked).toBe(false);
  });
  it("requires sign in", async () => {
    state.viewer = null;
    render(<ProjectHeart releaseId="project" />);
    fireEvent.click(screen.getByRole("button", { name: "Like project" }));
    await screen.findByText("Sign in to like");
    expect(state.writes).toHaveLength(0);
  });
  it("reads back liked projects and changes separate visibility", async () => {
    state.liked = true;
    render(<LikedProjects userId="owner" />);
    expect(await screen.findByRole("link", { name: /Winter/ })).toHaveAttribute("href", "/release/winter");
    fireEvent.click(screen.getByRole("button", { name: "Public" }));
    await waitFor(() => expect(state.public).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Private" }));
    await waitFor(() => expect(state.public).toBe(false));
  });
  it("hides private lists from visitors", async () => {
    state.viewer = null; state.liked = true;
    const { container } = render(<LikedProjects userId="owner" />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
  it("shows public lists without owner controls", async () => {
    state.viewer = null; state.liked = true; state.public = true;
    render(<LikedProjects userId="owner" />);
    await screen.findByText("Winter");
    expect(screen.queryByRole("button", { name: "Private" })).not.toBeInTheDocument();
  });
});