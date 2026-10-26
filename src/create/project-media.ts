import { archiveYouTubeEmbed } from "./archive-media";

export type MediaItem =
  | { kind: "embed"; url: string; embed: string; label: string; tall?: boolean }
  | { kind: "image"; url: string; label: string }
  | { kind: "video" | "audio"; url: string; label: string }
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
  const instagram = host === "instagram.com" && u.pathname.match(/\/(?:p|reel|reels|tv)\/([\w-]+)(?:\/|$)/);
  if (instagram) return { kind: "embed", url, embed: `https://www.instagram.com/p/${instagram[1]}/embed/`, label: "Instagram", tall: true };
  const tiktok = host === "tiktok.com" && u.pathname.match(/^\/@[^/]+\/video\/(\d+)\/?$/);
  if (tiktok) return { kind: "embed", url, embed: `https://www.tiktok.com/player/v1/${tiktok[1]}`, label: "TikTok", tall: true };
  if (host === "music.apple.com" && /^\/[a-z]{2}\/(album|playlist|music-video)\//.test(u.pathname))
    return { kind: "embed", url, embed: `https://embed.music.apple.com${u.pathname}${u.search}`, label: "Apple Music", tall: true };
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "video", url, label: "Video" };
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(u.pathname)) return { kind: "audio", url, label: "Audio" };
  if (/\.(jpe?g|png|webp|gif|avif)$/i.test(u.pathname)) return { kind: "image", url, label: "Image" };
  return { kind: "link", url, label: siteName(host), site: siteName(host) };
}

export function parseMediaLinks(list: unknown): MediaItem[] {
  const arr = Array.isArray(list) ? list : typeof list === "string" ? list.split(/\s+/) : [];
  const seen = new Set<string>();
  return arr.map((x) => classifyMedia(String(x))).filter((m): m is MediaItem => !!m && !seen.has(m.url) && !!seen.add(m.url)).slice(0, 24);
}
