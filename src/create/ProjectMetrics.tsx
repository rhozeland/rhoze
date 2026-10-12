import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PublicMetricsInput = {
  slug: string;
  milestones?: { done?: boolean }[] | null;
  openRoles?: number;
  mcap?: number | null;
};

const fmtMcap = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `$${Math.round(v).toLocaleString("en-US")}` : `$${v.toFixed(0)}`;

/** Small public badge row: likes, roadmap progress %, open roles, coin mcap. Safe to reuse anywhere a release is loaded. */
export function ProjectMetricsBadges({ slug, milestones, openRoles, mcap }: PublicMetricsInput) {
  const [likes, setLikes] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (supabase.rpc as any)("release_public_metrics", { p_slug: slug })
      .then(({ data }: any) => {
        if (!alive) return;
        const row = Array.isArray(data) ? data[0] : data;
        setLikes(typeof row?.likes === "number" ? row.likes : Number(row?.likes) || 0);
      })
      .catch(() => { if (alive) setLikes(null); });
    return () => { alive = false; };
  }, [slug]);

  const total = milestones?.length ?? 0;
  const done = milestones?.filter((m) => m?.done)?.length ?? 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : null;

  const items: { label: string; value: string }[] = [];
  if (likes !== null) items.push({ label: likes === 1 ? "like" : "likes", value: String(likes) });
  if (progress !== null) items.push({ label: "roadmap", value: `${progress}%` });
  if (typeof openRoles === "number" && openRoles > 0) items.push({ label: openRoles === 1 ? "open role" : "open roles", value: String(openRoles) });
  if (typeof mcap === "number" && Number.isFinite(mcap)) items.push({ label: "mcap", value: fmtMcap(mcap) });

  if (!items.length) return null;

  return (
    <div className="rz-metrics-badges" aria-label="Project metrics">
      {items.map((it) => (
        <span className="rz-metric-badge" key={it.label}>
          <b>{it.value}</b>
          <small>{it.label}</small>
        </span>
      ))}
    </div>
  );
}

export default ProjectMetricsBadges;
