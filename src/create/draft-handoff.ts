export const PENDING_DRAFT_KEY = "rz_pending_profile_draft";

export async function completeDraftHandoff(id: string, actions: {
  claim: () => Promise<void>;
  saveTeam: () => Promise<void>;
  list: () => Promise<{ id: string; status: string }[]>;
}) {
  await actions.claim();
  await actions.saveTeam();
  const rows = await actions.list();
  if (!rows.some(row => row.id === id && row.status !== "published" && row.status !== "archived")) {
    throw new Error("Your draft hasn't appeared in your account yet. Please try saving again.");
  }
  return "/me?drafts=1&saved=1";
}