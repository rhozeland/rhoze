import { useMemo } from "react";
import {
  ExternalLink,
  FileText,
  Sheet as SheetIcon,
  Presentation,
  FormInput,
  FolderOpen,
  HardDrive,
  Youtube,
  Video,
  FileIcon,
  ImageIcon,
  Music,
  Globe,
} from "lucide-react";
import IframePreview from "./IframePreview";

/** Structured info about a link we know how to embed. */
export type EmbedKind =
  | "gdoc"
  | "gsheet"
  | "gslide"
  | "gform"
  | "gdrive-file"
  | "gdrive-folder"
  | "gsite"
  | "youtube"
  | "loom"
  | "vimeo"
  | "dropbox"
  | "notion"
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "generic";

export interface ParsedEmbed {
  /** URL that can be placed in an <iframe src>. Null when only a link chip should render. */
  embedUrl: string | null;
  kind: EmbedKind;
  /** Provider-side resource id when available (Drive/Docs file id, YouTube video id, etc.). */
  id?: string;
  /** Preferred aspect ratio hint: 16/9 for video/slides, 4/3 or 3/4 for docs, etc. */
  aspectRatio?: number;
  /** Human label for the source. */
  provider: string;
}

function extractDriveId(url: string): string | null {
  const patterns = [
    /https?:\/\/(?:drive|docs)\.google\.com\/(?:file|uc)\/d\/([a-zA-Z0-9_-]{10,})/,
    /https?:\/\/drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]{10,})/,
    /https?:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Parse a shared link into an embed descriptor. Covers most common Google Drive/Docs
 * share formats (view, edit, copy, present, pub, uc, open?id=, /u/N/), plus YouTube,
 * Loom, Vimeo, Dropbox raw links, direct media, and notion.
 */
export function parseEmbed(url: string): ParsedEmbed | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname;

  // Google Docs / Sheets / Slides — normalize any edit/view/pub/present/copy variant to /preview
  const gDocs = url.match(
    /https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9_-]+)/,
  );
  if (gDocs) {
    const [, kindPath, id] = gDocs;
    const kind: EmbedKind =
      kindPath === "document" ? "gdoc" : kindPath === "spreadsheets" ? "gsheet" : "gslide";
    const aspectRatio = kind === "gdoc" ? 3 / 4 : 16 / 9;
    const isPub = /\/pub(?:$|\?|html)/.test(path);
    const embedBase = isPub
      ? `https://docs.google.com/${kindPath}/d/${id}/pubembed?start=false&loop=false&delayms=5000`
      : `https://docs.google.com/${kindPath}/d/${id}/preview`;
    return {
      embedUrl: embedBase,
      kind,
      id,
      aspectRatio,
      provider: kind === "gdoc" ? "Google Docs" : kind === "gsheet" ? "Google Sheets" : "Google Slides",
    };
  }

  // Google Forms
  const gForm = url.match(/https?:\/\/docs\.google\.com\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
  if (gForm) {
    const id = gForm[1];
    const isPublished = /\/forms\/(?:u\/\d+\/)?d\/e\//.test(url);
    return {
      embedUrl: isPublished
        ? `https://docs.google.com/forms/d/e/${id}/viewform?embedded=true`
        : `https://docs.google.com/forms/d/${id}/viewform?embedded=true`,
      kind: "gform",
      id,
      aspectRatio: 3 / 4,
      provider: "Google Forms",
    };
  }

  // Google Drive folder
  const folder = url.match(/https?:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  if (folder) {
    return {
      embedUrl: `https://drive.google.com/embeddedfolderview?id=${folder[1]}#grid`,
      kind: "gdrive-folder",
      id: folder[1],
      aspectRatio: 4 / 3,
      provider: "Google Drive folder",
    };
  }

  // Google Drive file — file/d/{id}, uc?id=, open?id=. Maps to /file/d/{id}/preview
  // which handles video, audio, images and PDFs with a native player.
  if (host === "drive.google.com" || host === "docs.google.com") {
    const id = extractDriveId(url);
    if (id && !/\/(document|spreadsheets|presentation|forms)\//.test(url)) {
      return {
        embedUrl: `https://drive.google.com/file/d/${id}/preview`,
        kind: "gdrive-file",
        id,
        aspectRatio: 16 / 9,
        provider: "Google Drive",
      };
    }
  }

  // Google Sites
  if (host === "sites.google.com") {
    return { embedUrl: url, kind: "gsite", aspectRatio: 4 / 3, provider: "Google Sites" };
  }

  // YouTube — watch, youtu.be, /shorts/, /live/, /embed/, playlists
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    let id: string | null = null;
    if (host === "youtu.be") id = path.slice(1).split("/")[0];
    else if (path.startsWith("/watch")) id = u.searchParams.get("v");
    else {
      const m = path.match(/^\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]+)/);
      if (m) id = m[1];
    }
    const list = u.searchParams.get("list");
    if (id) {
      const qs = list ? `?list=${encodeURIComponent(list)}` : "";
      return {
        embedUrl: `https://www.youtube.com/embed/${id}${qs}`,
        kind: "youtube",
        id,
        aspectRatio: 16 / 9,
        provider: "YouTube",
      };
    }
    if (list) {
      return {
        embedUrl: `https://www.youtube.com/embed/videoseries?list=${encodeURIComponent(list)}`,
        kind: "youtube",
        aspectRatio: 16 / 9,
        provider: "YouTube",
      };
    }
  }

  // Loom
  const loom = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
  if (loom) {
    return {
      embedUrl: `https://www.loom.com/embed/${loom[1]}`,
      kind: "loom",
      id: loom[1],
      aspectRatio: 16 / 9,
      provider: "Loom",
    };
  }

  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return {
      embedUrl: `https://player.vimeo.com/video/${vimeo[1]}`,
      kind: "vimeo",
      id: vimeo[1],
      aspectRatio: 16 / 9,
      provider: "Vimeo",
    };
  }

  // Dropbox — force raw so <iframe>/<video>/<img> renders instead of the landing page
  if (host.endsWith("dropbox.com")) {
    const raw = url.replace(/([?&])dl=0/, "$1raw=1").replace(/([?&])dl=1/, "$1raw=1");
    const withRaw = raw.includes("raw=1") ? raw : raw + (raw.includes("?") ? "&raw=1" : "?raw=1");
    return { embedUrl: withRaw, kind: "dropbox", aspectRatio: 16 / 9, provider: "Dropbox" };
  }

  // Notion
  if (host.endsWith("notion.site") || host === "notion.so") {
    return { embedUrl: url, kind: "notion", aspectRatio: 3 / 4, provider: "Notion" };
  }

  // Direct media by extension
  if (/\.pdf(\?|$)/i.test(path)) return { embedUrl: url, kind: "pdf", aspectRatio: 3 / 4, provider: "PDF" };
  if (/\.(png|jpe?g|gif|webp|svg|avif)(\?|$)/i.test(path))
    return { embedUrl: url, kind: "image", aspectRatio: 4 / 3, provider: "Image" };
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(path))
    return { embedUrl: url, kind: "video", aspectRatio: 16 / 9, provider: "Video" };
  if (/\.(mp3|wav|m4a|ogg|flac)(\?|$)/i.test(path))
    return { embedUrl: url, kind: "audio", provider: "Audio" };

  return null;
}

/** Legacy helper kept for callers that only need a URL string. */
export function toEmbedUrl(url: string): string | null {
  return parseEmbed(url)?.embedUrl ?? null;
}

function iconFor(kind: EmbedKind) {
  switch (kind) {
    case "gdoc": return FileText;
    case "gsheet": return SheetIcon;
    case "gslide": return Presentation;
    case "gform": return FormInput;
    case "gdrive-folder": return FolderOpen;
    case "gdrive-file": return HardDrive;
    case "youtube": return Youtube;
    case "loom":
    case "vimeo":
    case "video": return Video;
    case "audio": return Music;
    case "pdf": return FileIcon;
    case "image": return ImageIcon;
    default: return Globe;
  }
}

interface EmbedPreviewProps {
  url: string;
  title?: string;
  /** Explicit height. When omitted, height is derived from aspect ratio at the rendered width. */
  height?: number;
}

export default function EmbedPreview({ url, title, height }: EmbedPreviewProps) {
  const parsed = useMemo(() => parseEmbed(url), [url]);

  if (!parsed || !parsed.embedUrl) {
    let host = url;
    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* noop */ }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink size={14} /> {title || host}
      </a>
    );
  }

  const { embedUrl, kind, aspectRatio, provider } = parsed;
  const Icon = iconFor(kind);

  if (kind === "image") {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            <Icon size={12} /> {title || provider}
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Open <ExternalLink size={11} />
          </a>
        </div>
        <img src={embedUrl} alt={title || provider} className="w-full h-auto block" loading="lazy" />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
            <Icon size={12} /> {title || provider}
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Open <ExternalLink size={11} />
          </a>
        </div>
        <video src={embedUrl} controls className="w-full bg-black" preload="metadata" />
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="border border-border rounded-lg bg-card px-3 py-2 flex items-center gap-3">
        <Icon size={16} className="text-muted-foreground shrink-0" />
        <audio src={embedUrl} controls className="flex-1 min-w-0" preload="metadata" />
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          Open <ExternalLink size={11} />
        </a>
      </div>
    );
  }

  const useAspect = height == null && aspectRatio != null;
  const style: React.CSSProperties = useAspect
    ? { aspectRatio: `${aspectRatio}` }
    : { height: height ?? 480 };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 min-w-0">
          <Icon size={12} className="shrink-0" />
          <span className="truncate">{title || provider}</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0 ml-2"
        >
          Open <ExternalLink size={11} />
        </a>
      </div>
      <IframePreview
        src={embedUrl}
        title={title || provider}
        fallbackUrl={url}
        style={style}
        className="w-full"
      />
    </div>
  );
}