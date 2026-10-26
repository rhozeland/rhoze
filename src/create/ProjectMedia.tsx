import { useState } from "react";
import { ExternalLink, Image as ImageIcon, Play, CalendarDays, Link2 } from "lucide-react";
import { parseMediaLinks, type MediaItem } from "./project-media";
import { Button } from "@/components/ui/button";

/** Media viewer + social/event links for a project page. Renders nothing when there's nothing to show. */
export default function ProjectMedia({ links, cover, title }: { links: unknown; cover?: string | null; title: string }) {
  const items = parseMediaLinks(links);
  const viewable = [...items.filter((m) => m.kind !== "link"), ...(cover && !items.some(m => m.url === cover) ? [{ kind: "image", url: cover, label: "Cover" } as MediaItem] : [])];
  const outbound = items.filter((m): m is Extract<MediaItem, { kind: "link" }> => m.kind === "link");
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
      {cur && cur.kind !== "image" && <p className="rz-note">{cur.label} · <a href={cur.url} target="_blank" rel="noopener noreferrer">Open source if playback is unavailable <ExternalLink size={11} /></a></p>}
      {outbound.length > 0 && (
        <div className="rz-media-links">
          {outbound.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="rz-chip">
              {/Luma|Eventbrite/.test(l.site) ? <CalendarDays size={13} /> : l.site.includes(".") ? <Link2 size={13} /> : <ImageIcon size={13} />}
              <b>{l.site}</b><ExternalLink size={11} />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
