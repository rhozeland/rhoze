import { ExternalLink } from "lucide-react";

/**
 * Converts a Google Drive / Docs / Sheets / Slides URL into an embeddable preview URL.
 * Falls back to rendering as a generic iframe for other URLs.
 */
export function toEmbedUrl(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // Google Docs / Sheets / Slides — convert to /preview
    const gMatch = url.match(/https?:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (gMatch) {
      return `https://docs.google.com/${gMatch[1]}/d/${gMatch[2]}/preview`;
    }

    // Google Forms — embed via the published viewform URL
    const formMatch = url.match(/https?:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
    if (formMatch) {
      const id = formMatch[1];
      const isPublished = /\/forms\/d\/e\//.test(url);
      return isPublished
        ? `https://docs.google.com/forms/d/e/${id}/viewform?embedded=true`
        : `https://docs.google.com/forms/d/${id}/viewform?embedded=true`;
    }

    // Google Drive file
    const dMatch =
      url.match(/https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      url.match(/https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
    if (dMatch) return `https://drive.google.com/file/d/${dMatch[1]}/preview`;

    // Google Drive folder
    const folderMatch = url.match(/https?:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#list`;

    // YouTube
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;

    // Loom
    const loom = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
    if (loom) return `https://www.loom.com/embed/${loom[1]}`;

    // Direct PDF or image — let iframe render it
    if (/\.(pdf|png|jpe?g|gif|webp|svg)(\?|$)/i.test(u.pathname)) return url;

    // Notion public pages
    if (host.endsWith("notion.site") || host === "notion.so") return url;

    return null;
  } catch {
    return null;
  }
}

interface EmbedPreviewProps {
  url: string;
  title?: string;
  height?: number;
}

export default function EmbedPreview({ url, title, height = 480 }: EmbedPreviewProps) {
  const embedUrl = toEmbedUrl(url);

  if (!embedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <ExternalLink size={14} /> {title || url}
      </a>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="text-xs text-muted-foreground truncate">{title || new URL(url).hostname}</div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Open <ExternalLink size={11} />
        </a>
      </div>
      <iframe
        src={embedUrl}
        title={title || "Embedded preview"}
        className="w-full bg-background"
        style={{ height }}
        allow="autoplay; encrypted-media; fullscreen"
        loading="lazy"
      />
    </div>
  );
}