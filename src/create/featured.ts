// Get Featured: shared labels and form validation (rules mirrored by database checks).
export type FeaturedCategory = "artist" | "brand" | "creator";
export const FEATURED_CATEGORIES: { id: FeaturedCategory; title: string; desc: string; nameLabel: string }[] = [
  { id: "artist", title: "Artists", desc: "Musicians, singers, producers and independent music projects.", nameLabel: "Artist or project name" },
  { id: "brand", title: "Brands", desc: "Startups, businesses, entrepreneurs and emerging brands.", nameLabel: "Brand name" },
  { id: "creator", title: "Creators", desc: "Designers, photographers, filmmakers and visual artists.", nameLabel: "Creator or project name" },
];
// Extra questions shown for each category, saved in `details`.
export const CATEGORY_FIELDS: Record<FeaturedCategory, { key: string; label: string; placeholder: string }[]> = {
  artist: [{ key: "genre", label: "Genre", placeholder: "R&B, hip-hop, indie…" }, { key: "release", label: "Latest release", placeholder: "Song or album title" }],
  brand: [{ key: "industry", label: "Industry", placeholder: "Fashion, food, tech…" }, { key: "stage", label: "Stage", placeholder: "Just launched, growing…" }],
  creator: [{ key: "discipline", label: "Discipline", placeholder: "Photography, film, design…" }, { key: "tools", label: "Tools or medium", placeholder: "35mm, Blender, oil paint…" }],
};
export type FeaturedStatus = "submitted" | "under_review" | "more_info" | "approved" | "in_production" | "scheduled" | "published" | "declined";
export const STATUS_LABELS: Record<FeaturedStatus, string> = {
  submitted: "Submitted", under_review: "Under review", more_info: "More information needed", approved: "Approved",
  in_production: "In production", scheduled: "Scheduled", published: "Published", declined: "Declined",
};
export const STATUS_ORDER = Object.keys(STATUS_LABELS) as FeaturedStatus[];
export const MAX_SUPPORTING = 5;

const isUrl = (v: string) => { try { const u = new URL(v.trim()); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };

export type AboutForm = { name: string; description: string; instagram: string; website: string; main_link: string; extra_links: string[]; pitch: string };
export function aboutError(f: AboutForm): string | null {
  if (!f.name.trim()) return "Add a name.";
  if (!f.description.trim()) return "Add a short description.";
  if (f.description.length > 1000) return "Keep the description under 1,000 characters.";
  if (!f.instagram.trim()) return "Add your Instagram profile.";
  if (f.website.trim() && !isUrl(f.website)) return "The website should be a full link starting with https://";
  if (!isUrl(f.main_link)) return "The main link should be a full link starting with https://";
  if (f.extra_links.filter((l) => l.trim()).some((l) => !isUrl(l))) return "Each additional link should start with https://";
  if (!f.pitch.trim()) return "Tell us why we should feature your work.";
  if (f.pitch.length > 1500) return "Keep this under 1,500 characters.";
  return null;
}
export function contentError(c: { primary: boolean; supporting: number; video: string; ownership: boolean; promotion: boolean }): string | null {
  if (!c.primary) return "Add a primary image.";
  if (c.supporting > MAX_SUPPORTING) return `Add up to ${MAX_SUPPORTING} supporting images.`;
  if (c.video.trim() && !isUrl(c.video)) return "The video link should start with https://";
  if (!c.ownership || !c.promotion) return "Please agree to both permissions to submit.";
  return null;
}
