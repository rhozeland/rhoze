import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Eye, Lock, Trash2, Upload, Link2 } from "lucide-react";
import ProjectMedia from "./ProjectMedia";
import "./project-content.css";

type Kind = "image" | "video" | "audio";
type Vis = "holders" | "public";
export type ContentPost = { id: string; body: string; media_path: string | null; media_kind: Kind | null; link_url: string | null; visibility?: Vis; created_at: string; media_url?: string | null };

/** Fetches media into a blob: URL so Chrome never blocks the preview. */
function Media({ url, kind }: { url: string; kind: Kind }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let off = false, made = "";
    fetch(url).then((r) => r.blob()).then((b) => { if (!off) { made = URL.createObjectURL(b); setSrc(made); } }).catch(() => {});
    return () => { off = true; if (made) URL.revokeObjectURL(made); };
  }, [url]);
  if (!src) return <div className="rz-ct-loading">Loading…</div>;
  if (kind === "image") return <img src={src} alt="" />;
  if (kind === "video") return <video src={src} controls playsInline preload="metadata" />;
  return <audio src={src} controls />;
}

export function ContentCard({ p, title, footer }: { p: ContentPost; title: string; footer?: React.ReactNode }) {
  return (
    <article className="rz-ct-card">
      {p.media_url && p.media_kind && <div className="rz-ct-media"><Media url={p.media_url} kind={p.media_kind} /></div>}
      {p.link_url && <div className="rz-ct-media"><ProjectMedia links={[p.link_url]} title={title} /></div>}
      {p.body && <p>{p.body}</p>}
      {footer}
    </article>
  );
}

const sign = async (path: string) => (await supabase.storage.from("release-posts").createSignedUrl(path, 3600)).data?.signedUrl ?? null;

/** Owner's content studio: post updates, videos, photos and behind-the-scenes, each holders-only or a public teaser. */
export default function ProjectContent({ r }: { r: any }) {
  const [posts, setPosts] = useState<ContentPost[] | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [link, setLink] = useState("");
  const [vis, setVis] = useState<Vis>(r.coin_mint ? "holders" : "public");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await (supabase.from as any)("release_posts").select("id,body,media_path,media_kind,link_url,visibility,created_at").eq("release_id", r.id).order("created_at", { ascending: false });
    setPosts(await Promise.all((data || []).map(async (p: any) => ({ ...p, media_url: p.media_path ? await sign(p.media_path) : null }))));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [r.id]);

  const kindOf = (f: File): Kind | null => f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : null;

  const submit = async () => {
    const body = text.trim(); const url = link.trim();
    if (!body && !files.length && !url) return setErr("Add a caption, a file or a link.");
    if (url && !/^https:\/\//i.test(url)) return setErr("Links must start with https://");
    for (const f of files) { if (!kindOf(f)) return setErr(`${f.name} isn't a photo, video or audio file.`); if (f.size > 50 * 1024 * 1024) return setErr(`${f.name} is over 50 MB.`); }
    setBusy(true); setErr("");
    const { data: u } = await supabase.auth.getUser();
    const rows: any[] = [];
    for (const [i, f] of files.entries()) {
      const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${r.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("release-posts").upload(path, f, { contentType: f.type });
      if (error) { setBusy(false); return setErr(`${f.name} couldn't upload. Try again.`); }
      rows.push({ release_id: r.id, user_id: u.user?.id, body: i === 0 ? body : "", media_path: path, media_kind: kindOf(f), visibility: vis, link_url: i === 0 && url ? url : null });
    }
    if (!rows.length) rows.push({ release_id: r.id, user_id: u.user?.id, body, link_url: url || null, visibility: vis });
    const { error } = await (supabase.from as any)("release_posts").insert(rows);
    setBusy(false);
    if (error) return setErr("Couldn't post that. Try again.");
    setText(""); setFiles([]); setLink(""); load();
  };

  const toggle = async (p: ContentPost) => {
    const next: Vis = p.visibility === "public" ? "holders" : "public";
    setPosts((ps) => ps!.map((x) => x.id === p.id ? { ...x, visibility: next } : x));
    const { error } = await (supabase.from as any)("release_posts").update({ visibility: next }).eq("id", p.id);
    if (error) { setErr("Couldn't change who sees it."); load(); }
  };
  const remove = async (p: ContentPost) => {
    if (!window.confirm("Delete this post for good?")) return;
    await (supabase.from as any)("release_posts").delete().eq("id", p.id);
    if (p.media_path) await supabase.storage.from("release-posts").remove([p.media_path]);
    setPosts((ps) => ps!.filter((x) => x.id !== p.id));
  };

  const publicCount = (posts || []).filter((p) => p.visibility === "public").length;
  return (
    <div className="rz-ct">
      <div className="rz-ct-compose">
        <h3>Add content</h3>
        <p className="rz-ct-hint">Videos, photos, audio, links or written updates. Keep most for {r.coin_mint ? "coin holders" : "supporters"} and make a few public as a teaser.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} placeholder="Write an update or a caption — e.g. behind the scenes from today's shoot" aria-label="Caption" />
        <div className="rz-ct-row">
          <label className="rz-ct-file"><Upload size={15} aria-hidden="true" />{files.length ? `${files.length} file${files.length > 1 ? "s" : ""} chosen` : "Upload photos / videos / audio"}
            <input type="file" multiple accept="image/*,video/*,audio/*" hidden onChange={(e) => { setFiles(Array.from(e.target.files || [])); e.target.value = ""; }} /></label>
          <label className="rz-ct-link"><Link2 size={15} aria-hidden="true" /><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="YouTube, TikTok, Instagram, Spotify link" aria-label="Link" /></label>
        </div>
        <div className="rz-ct-row">
          <div className="rz-ct-vis" role="radiogroup" aria-label="Who can see this">
            <button type="button" role="radio" aria-checked={vis === "holders"} onClick={() => setVis("holders")}><Lock size={13} aria-hidden="true" />Holders only</button>
            <button type="button" role="radio" aria-checked={vis === "public"} onClick={() => setVis("public")}><Eye size={13} aria-hidden="true" />Public teaser</button>
          </div>
          <Button type="button" className="rz-ct-post" disabled={busy} onClick={submit}>{busy ? "Posting…" : "Post"}</Button>
        </div>
        {err && <p role="alert" className="rz-ct-err">{err}</p>}
      </div>

      <div className="rz-ct-head"><h3>Your content</h3>{posts && <small>{posts.length} posts · {publicCount} public teaser{publicCount === 1 ? "" : "s"}{r.status !== "published" && " · teasers show once the project is published"}</small>}</div>
      {posts === null ? <p className="rz-ct-hint">Loading…</p> : !posts.length ? <p className="rz-ct-empty">Nothing yet. Your first post could be a behind-the-scenes video or a sneak peek photo.</p> : (
        <div className="rz-ct-grid">
          {posts.map((p) => <ContentCard key={p.id} p={p} title={r.title} footer={
            <div className="rz-ct-foot">
              <button type="button" className={`rz-ct-badge${p.visibility === "public" ? " pub" : ""}`} onClick={() => toggle(p)} title="Click to change who sees this">{p.visibility === "public" ? <><Eye size={12} />Public teaser</> : <><Lock size={12} />Holders only</>}</button>
              <button type="button" className="rz-ct-del" aria-label="Delete post" onClick={() => remove(p)}><Trash2 size={14} /></button>
            </div>} />)}
        </div>
      )}
    </div>
  );
}

/** Public teaser posts on a published project page. */
export function PublicTeasers({ slug, title, locked }: { slug: string; title: string; locked: boolean }) {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  useEffect(() => {
    (supabase.rpc as any)("release_public_posts", { p_slug: slug }).then(async ({ data }: any) => {
      setPosts(await Promise.all((data || []).map(async (p: any) => ({ ...p, media_url: p.media_path ? await sign(p.media_path) : null }))));
    });
  }, [slug]);
  if (!posts.length) return null;
  return (
    <section className="rz-ct rz-ct-public" aria-label="Behind the scenes">
      <div className="rz-ct-head"><h3>Behind the scenes</h3>{locked && <small>More for holders in Exclusive</small>}</div>
      <div className="rz-ct-grid">{posts.map((p) => <ContentCard key={p.id} p={p} title={title} />)}</div>
    </section>
  );
}
