import { archiveYouTubeEmbed } from "./archive-media";

export type MediaItem =
  | { kind: "embed"; url: string; embed: string; label: string; tall?: boolean }
  | { kind: "image"; url: string; label: string }
  | { kind: "link"; url: string; label: string; site: string };

const SITES: [RegExp, string][] = [
  [/instagram\.com$/, "Instagram"], [/tiktok\.com$/, "TikTok"], [/(twitter|x)\.com$/, "X"],
  [/eventbrite\.\w+$/, "Eventbrite"], [/(lu\.ma|luma\.com)$/, "Luma"], [/bandcamp\.com$/, "Bandcamp"],
  [/music\.apple\.com$/, "Apple Music"], [/linkedin\.com$/, "LinkedIn"], [/behance\.net$/, "Behance"],
  [/dribbble\.com$/, "Dribbble"], [/youtube\.com$|youtu\.be$/, "YouTube"], [/spotify\.com$/, "Spotify"],
  [/soundcloud\.com$/, "SoundCloud"], [/vimeo\.com$/, "Vimeo"],
];

export function siteName(host: string): string {
  const h = host.replace(/^www\./, "").toLowerCase();
  return SITES.find(([re]) => re.test(h))?.[1] ?? h;
}

/** Turns one pasted link into something the project page can show. Unknown/unsafe → null. */
export function classifyMedia(raw: string): MediaItem | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const url = u.toString();
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const yt = archiveYouTubeEmbed(url);
  if (yt) return { kind: "embed", url, embed: yt, label: "YouTube" };
  const vimeo = host === "vimeo.com" && u.pathname.match(/^\/(\d+)/);
  if (vimeo) return { kind: "embed", url, embed: `https://player.vimeo.com/video/${vimeo[1]}`, label: "Vimeo" };
  const sp = host === "open.spotify.com" && u.pathname.match(/^\/(track|album|playlist|episode|show|artist)\/([\w]+)/);
  if (sp) return { kind: "embed", url, embed: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}`, label: "Spotify", tall: sp[1] !== "track" };
  if (host === "soundcloud.com" && u.pathname.length > 1)
    return { kind: "embed", url, embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&visual=true`, label: "SoundCloud" };
  if (/\.(jpe?g|png|webp|gif|avif)$/i.test(u.pathname)) return { kind: "image", url, label: "Image" };
  return { kind: "link", url, label: siteName(host), site: siteName(host) };
}

export function parseMediaLinks(list: unknown): MediaItem[] {
  const arr = Array.isArray(list) ? list : typeof list === "string" ? list.split(/\s+/) : [];
  const seen = new Set<string>();
  return arr.map((x) => classifyMedia(String(x))).filter((m): m is MediaItem => !!m && !seen.has(m.url) && !!seen.add(m.url)).slice(0, 24);
}
