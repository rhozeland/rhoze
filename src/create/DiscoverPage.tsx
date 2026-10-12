import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "./shared";
import { ProjectHeart } from "./ProjectLikes";
import DiscoverGlobe, { type GlobePin } from "./globe/DiscoverGlobe";
import { Button } from "@/components/ui/button";
import StudioProjects from "./StudioProjects";
import ExistingProjects from "./ExistingProjects";
import { hasOpenRoles } from "./project-flow";
import { jitterFor } from "./globe/geo";

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

type Creator = {
  id: string;
  slug: string | null;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
};

const FILTERS = ["All", "Music", "Film & Video", "Art & Design", "Fashion", "Brand campaigns", "Open roles"] as const;
type Filter = (typeof FILTERS)[number];

const EMPTY_LABEL: Record<Filter, string> = {
  "Open roles": "No open roles yet.",
  "All": "No projects yet — create one",
  "Music": "No music projects yet.",
  "Film & Video": "No film or video projects yet.",
  "Art & Design": "No art or design projects yet.",
  "Fashion": "No fashion projects yet.",
  "Brand campaigns": "No brand campaigns yet.",
};

const MUSIC_WORDS = /\b(music|song|ep|album|single|track|mixtape|beat|record|audio|songwriter|rap|trap|singer|singing|melody|lyrics)\b/i;
const FILM_WORDS = /\b(film|movie|short film|documentary|doc|video|music video|clip|trailer|cinema|cinematic|animation|animated|shoot|photoshoot|director|editing)\b/i;
const ART_WORDS = /\b(art|artwork|painting|paint|illustration|illustrate|drawing|sketch|poster|mural|exhibition|gallery|sculpture|graphic|design|designer)\b/i;
const FASHION_WORDS = /\b(fashion|clothing|apparel|streetwear|collection|hoodie|tee|jersey|jean|jeans|denim|jacket|coat|sneaker|shoe|boot|jewelry|accessory|accessories|lookbook|runway|outfit|textile|couture)\b/i;

const textOf = (r: Release) => `${r.title} ${r.creator_name} ${r.answers?.making ?? ""} ${r.answers?.audience ?? ""}`;

export default function DiscoverPage() {
  const [rows, setRows] = useState<Release[] | undefined>(undefined);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [filter, setFilter] = useState<Filter>(new URLSearchParams(location.search).get("filter") === "Open roles" ? "Open roles" : "All");

  useEffect(() => {
    document.title = "Discover | Rhozeland";
    (supabase.from as any)("releases")
      .select("id,slug,title,creator_name,answers,coin_ticker,coin_image,cover_url,published_at,cause_name")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }: any) => setRows((data ?? []) as Release[]), () => setRows([]));

    (supabase.from as any)("creator_directory")
      .select("id,slug,display_name,photo_url,bio")
      .eq("is_public", true)
      .then(({ data }: any) => setCreators((data ?? []) as Creator[]), () => setCreators([]));
  }, []);

  const visible = useMemo(() => {
    if (!rows) return rows;
    switch (filter) {
      case "Open roles": return rows.filter((r) => hasOpenRoles(r.answers));
      case "Music":
        return rows.filter((r) => MUSIC_WORDS.test(textOf(r)));
      case "Film & Video":
        return rows.filter((r) => FILM_WORDS.test(textOf(r)));
      case "Art & Design":
        return rows.filter((r) => ART_WORDS.test(textOf(r)));
      case "Fashion":
        return rows.filter((r) => FASHION_WORDS.test(textOf(r)));
      case "Brand campaigns":
        return rows.filter((r) => r.answers?.project_type === "brand");
      default:
        return rows;
    }
  }, [rows, filter]);

  const pins = useMemo<GlobePin[]>(() => {
    const releasePins: GlobePin[] = (rows ?? []).slice(0, 24).map((r) => {
      const coords = jitterFor(`release-${r.id}`);
      return {
        id: `release-${r.id}`,
        kind: "release",
        title: r.title,
        subtitle: r.creator_name || "Rhozeland artist",
        image: (r as any).cover_url || r.coin_image || null,
        href: `/release/${r.slug}`,
        city: "Toronto",
        ...coords,
      };
    });
    const creatorPins: GlobePin[] = creators.slice(0, 24).map((c) => {
      const coords = jitterFor(`creator-${c.id}`);
      return {
        id: `creator-${c.id}`,
        kind: "creator",
        title: c.display_name,
        subtitle: c.bio,
        image: c.photo_url,
        href: `/creator/${c.slug || c.id}`,
        city: "Toronto",
        ...coords,
      };
    });
    return [...releasePins, ...creatorPins];
  }, [rows, creators]);

  return (
    <Shell right={<a className="rz-btn" href="/create.html?new=1">Create a project</a>}>
      <div className="rz-discover-content">
        <div className="rz-head">
          <h1>Discover</h1>
          <ExistingProjects />
        </div>

        <DiscoverGlobe pins={pins} />

        <div className="rz-chips" role="tablist" aria-label="Filter projects">
          {FILTERS.map((f) => (
            <Button variant="outline"
              key={f}
              type="button"
              className={`rz-chipbtn ${filter === f ? "on" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>

        {rows === undefined && (
          <div className="rz-feed">
            <div className="rz-skel" /><div className="rz-skel" /><div className="rz-skel" />
          </div>
        )}

        {rows !== undefined && visible && visible.length === 0 && filter !== "All" && (
          <div className="rz-empty">
            <p>{EMPTY_LABEL[filter]}</p>
            <a className="rz-btn" href="/create.html?new=1">Create a project</a>
          </div>
        )}

        {visible && visible.length > 0 && (
          <div className="rz-feed">
            {visible.map((r) => {
              const ticker = r.coin_ticker ? String(r.coin_ticker).replace(/^\$/, "") : "";
              return (
                <div key={r.id} className="rz-like-card"><a className="rz-feed-card" href={`/release/${r.slug}`}>
                  <span className="rz-feed-cover">
                    {(r as any).cover_url || r.coin_image ? <img src={(r as any).cover_url || r.coin_image || ""} alt={`${r.title} artwork`} /> : <i>{r.title}</i>}
                  </span>
                  <span className="rz-feed-meta">
                    <small>{r.creator_name || "Rhozeland artist"}</small>
                    <b>{r.title}</b>
                    <span className="rz-chip">
                      {r.coin_image && <img src={r.coin_image} alt="" />}
                      {ticker ? <b>${ticker}</b> : <small>No coin yet</small>}
                    </span>
                  </span>
                </a><ProjectHeart releaseId={r.id} /></div>
              );
            })}
          </div>
        )}
        <StudioProjects filter={filter} />
      </div>
    </Shell>
  );
}
