import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AuthModal from "./AuthModal";
import "./project-likes.css";

export function ProjectHeart({ releaseId }: { releaseId: string }) {
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [auth, setAuth] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (alive) setLiked(false); return; }
      const { data } = await supabase.from("project_likes").select("release_id").eq("user_id", session.user.id).eq("release_id", releaseId).maybeSingle();
      if (alive) setLiked(!!data);
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(load, 0); });
    window.addEventListener("focus", load);
    return () => { alive = false; subscription.unsubscribe(); window.removeEventListener("focus", load); };
  }, [releaseId]);
  const toggle = async () => {
    setBusy(true); setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setAuth(true); return; }
      const result = liked
        ? await supabase.from("project_likes").delete().eq("user_id", session.user.id).eq("release_id", releaseId)
        : await supabase.from("project_likes").insert({ user_id: session.user.id, release_id: releaseId });
      if (result.error) setError("Couldn’t save your like. Please try again.");
      else setLiked(!liked);
    } catch { setError("Couldn’t save your like. Please try again."); }
    finally { setBusy(false); }
  };
  return <>
    <span className="rz-like-control">
      <Button variant="outline" size="icon" className="rz-project-heart rz-release-share" aria-label={liked ? "Unlike project" : "Like project"} title={liked ? "Unlike project" : "Like project"} aria-pressed={liked} disabled={busy} onClick={toggle}><Heart size={16} /></Button>
      {error && <span className="rz-like-error" role="alert">{error}</span>}
    </span>
    {auth && <AuthModal action="" intro="Sign in to like this project." redirectTo={`${location.origin}/me`} onClose={() => setAuth(false)} onDone={() => { setAuth(false); toggle(); }} />}
  </>;
}

function LikedCover({ url, title }: { url: string; title: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true; let blobUrl = "";
    fetch(url).then(r => r.blob()).then(blob => {
      blobUrl = URL.createObjectURL(blob.type === "application/octet-stream" ? new Blob([blob], { type: "image/jpeg" }) : blob);
      if (alive) setSrc(blobUrl);
    }).catch(() => {});
    return () => { alive = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [url]);
  return src ? <img src={src} alt={`${title} artwork`} loading="lazy" /> : <i>{title}</i>;
}

export function LikedProjects({ userId }: { userId: string }) {
  const [own, setOwn] = useState(false);
  const [isPublic, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const [prefs, likes] = await Promise.all([
        supabase.from("project_like_preferences").select("is_public").eq("user_id", userId).maybeSingle(),
        supabase.from("project_likes").select("created_at,releases(id,slug,title,creator_name,cover_url,coin_image)").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      if (!alive) return;
      setOwn(session?.user.id === userId); setPublic(prefs.data?.is_public === true);
      if (prefs.error || likes.error) setError("Couldn’t load liked projects. Please refresh to try again.");
      setRows((likes.data ?? []).flatMap(l => l.releases ? [l.releases] : []));
    };
    load();
    return () => { alive = false; };
  }, [userId]);
  const changeVisibility = async (value: boolean) => {
    setBusy(true); setError("");
    const { error } = await supabase.from("project_like_preferences").upsert({ user_id: userId, is_public: value });
    if (error) setError("Couldn’t update visibility. Please try again."); else setPublic(value);
    setBusy(false);
  };
  if (!own && !isPublic) return null;
  return <section className="rz-pf-sec" aria-label="Liked projects">
    <div className="rz-liked-heading"><h2>Liked projects</h2>
      {own && <div className="rz-liked-visibility" role="group" aria-label="Liked projects visibility"><span>Visibility</span>
        <div className="rz-liked-toggle">
          <button type="button" aria-pressed={isPublic} disabled={busy} onClick={() => changeVisibility(true)}>Public</button>
          <button type="button" aria-pressed={!isPublic} disabled={busy} onClick={() => changeVisibility(false)}>Private</button>
        </div>
      </div>}
    </div>
    {error && <p role="alert" className="rz-pf-empty">{error}</p>}
    {rows === null ? <p className="rz-pf-empty">Loading…</p> : rows.length === 0 ? <p className="rz-pf-empty">{own ? "No liked projects yet." : "No liked projects yet."}</p> : <div className="rz-feed">{rows.map(r => <a key={r.id} className="rz-feed-card" href={`/release/${r.slug}`}>
      <span className="rz-feed-cover">{r.cover_url || r.coin_image ? <LikedCover url={r.cover_url || r.coin_image} title={r.title} /> : <i>{r.title}</i>}</span>
      <span className="rz-feed-meta"><small>{r.creator_name}</small><b>{r.title}</b></span>
    </a>)}</div>}
  </section>;
}