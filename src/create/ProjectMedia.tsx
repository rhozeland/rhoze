import { useState } from "react";
import { ExternalLink, Play, CalendarDays, Link2, Youtube, Instagram, Music2, Linkedin } from "lucide-react";
import { parseMediaLinks, type MediaItem } from "./project-media";
import { Button } from "@/components/ui/button";
import './project-media.css';

function PlatformIcon({ name }: { name: string }) {
  if (name === "Spotify") return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M6.5 9c4-1.4 8-1 11 1M7 12.5c3.5-1.1 6.9-.7 9.5 1M8 16c2.7-.8 5.3-.5 7.5.8" strokeLinecap="round" /></svg>;
  if (name === "SoundCloud") return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 13v3m3-6v7m3-9v9m3-11v11m3 0h5a3 3 0 0 0 0-6h-1a5 5 0 0 0-4-5Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (name === "YouTube") return <Youtube size={18} />;
  if (name === "Instagram") return <Instagram size={18} />;
  if (name === "LinkedIn") return <Linkedin size={18} />;
  if (/Luma|Eventbrite/.test(name)) return <CalendarDays size={18} />;
  if (/Apple Music|Bandcamp|TikTok/.test(name)) return <Music2 size={18} />;
  return <Link2 size={18} />;
}

/** Media viewer + social/event links for a project page. Renders nothing when there's nothing to show. */
export default function ProjectMedia({ links, cover, title }: { links: unknown; cover?: string | null; title: string }) {
  const items = parseMediaLinks(links);
  const viewable = [...items.filter((m) => m.kind !== "link"), ...(cover && !items.some(m => m.url === cover) ? [{ kind: "image", url: cover, label: "Cover" } as MediaItem] : [])];
  const outbound = items.filter(m => m.kind !== "image");
  const [i, setI] = useState(0);
  if (!viewable.length && !outbound.length) return null;
  const cur = viewable[Math.min(i, viewable.length - 1)];
  return (
    <section className="rz-media" aria-label="Project media">
      {cur && (
        <div className={`rz-media-stage${cur.kind === "embed" && cur.tall ? " tall" : ""}${cur.kind === "image" ? " img" : ""}`}>
          {cur.kind === "embed"
            ? <iframe key={cur.embed} src={cur.embed} title={`${title} · ${cur.label}`} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            : cur.kind === "video" ? <video key={cur.url} controls playsInline src={cur.url} poster={cover || undefined} />
            : cur.kind === "audio" ? <audio key={cur.url} controls src={cur.url} />
            : <img src={cur.url} alt={`${title} ${cur.label}`} />}
        </div>
      )}
      {viewable.length > 1 && (
        <div className="rz-media-strip" role="tablist" aria-label="Choose media">
          {viewable.map((m, k) => (
            <Button variant="outline" key={m.url} role="tab" aria-selected={k === i} className="rz-media-thumb" onClick={() => setI(k)} title={m.label}>
              {m.kind === "image" ? <img src={m.url} alt="" /> : <span><Play size={14} />{m.label}</span>}
            </Button>
          ))}
        </div>
      )}
      {outbound.length > 0 && (
        <div className="rz-media-links">
          {outbound.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rz-media-platform" aria-label={`Open ${title} on ${l.label}`} title={`Open on ${l.label}`}>
              <PlatformIcon name={l.label} /><ExternalLink size={9} className="rz-media-platform-external" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
