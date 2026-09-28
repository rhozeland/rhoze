import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "./shared";

type Release = {
  id: string;
  slug: string;
  title: string;
  creator_name: string;
  answers: any;
  coin_ticker: string | null;
  coin_image: string | null;
  published_at: string;
};

const FILTERS = ["All", "Music", "Cause", "Live", "Unlocks"] as const;
type Filter = (typeof FILTERS)[number];

const MUSIC_WORDS = /\b(music|song|ep|album|single|track|mixtape|beat|record|audio)\b/i;

export default function DiscoverPage() {
  const [rows, setRows] = useState<Release[] | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    document.title = "Discover | Rhozeland";
    (supabase.from as any)("releases")
      .select("id,slug,title,creator_name,answers,coin_ticker,coin_image,published_at,cause_name")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }: any) => setRows((data ?? []) as Release[]), () => setRows([]));
  }, []);

  const visible = useMemo(() => {
    if (!rows) return rows;
    switch (filter) {
      case "Music":
        return rows.filter((r) =>
          MUSIC_WORDS.test(`${r.title} ${r.answers?.making ?? ""} ${r.answers?.audience ?? ""}`));
      case "Cause":
        return rows.filter((r) => (r as any).cause_name);
      case "Live":
        return rows; // any published project counts as live
      case "Unlocks":
        return rows; // every published project has at least one unlocked item
      default:
        return rows;
    }
  }, [rows, filter]);

  return (
    <Shell right={<a className="rz-link" href="/create.html?new=1">Create a project</a>}>
      <div className="rz-card rz-card-wide">
        <div className="rz-head">
          <h1>Discover</h1>
          <p>New projects from independent artists, newest first.</p>
        </div>

        <div className="rz-chips" role="tablist" aria-label="Filter projects">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`rz-chipbtn ${filter === f ? "on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {rows === undefined && (
          <div className="rz-feed">
            <div className="rz-skel" /><div className="rz-skel" /><div className="rz-skel" />
          </div>
        )}

        {rows !== undefined && visible && visible.length === 0 && (
          <div className="rz-empty">
            <p>No projects yet — create one</p>
            <a className="rz-btn pri" href="/create.html?new=1">Create a project</a>
          </div>
        )}

        {visible && visible.length > 0 && (
          <div className="rz-feed">
            {visible.map((r) => {
              const ticker = r.coin_ticker ? String(r.coin_ticker).replace(/^\$/, "") : "";
              return (
                <a key={r.id} className="rz-feed-card" href={`/release/${r.slug}`}>
                  <span className="rz-feed-cover">
                    {r.coin_image ? <img src={r.coin_image} alt={`${r.title} artwork`} /> : <i>{r.title}</i>}
                  </span>
                  <span className="rz-feed-meta">
                    <small>{r.creator_name || "Rhozeland artist"}</small>
                    <b>{r.title}</b>
                    <span className="rz-chip">
                      {r.coin_image && <img src={r.coin_image} alt="" />}
                      {ticker ? <b>${ticker}</b> : <small>No coin yet</small>}
                    </span>
                  </span>
                  <span className="rz-btn pri rz-feed-cta">{ticker ? "Support" : "Open"}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
