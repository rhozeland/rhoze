import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "./shared";
import AuthModal from "./AuthModal";
import { ProfileTools, Lightbox, MoreCreators, embedUrl } from "./ProfileExtras";

export const slugify = (t: string) => (t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const db = supabase as any;
const fromSlug = () => new URLSearchParams(location.search).get("from");

function DraftsLink() {
  return (
    <a className="rz-drafts-link" href="/my-projects?filter=draft" title="See your drafts" aria-label="See your drafts">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      Drafts
    </a>
  );
}

function ProjectGrid({ rels }: { rels: any[] }) {
  const from = fromSlug();
  useEffect(() => { if (from) document.getElementById(`rz-proj-${from}`)?.scrollIntoView({ block: "nearest" }); }, [from, rels.length]);
  if (!rels.length) return <p className="rz-pf-empty">No published projects yet.</p>;
  return (
    <div className="rz-feed">
      {rels.map((r) => (
        <a key={r.id} id={`rz-proj-${r.slug}`} className={`rz-feed-card${r.slug === from ? " rz-came" : ""}`} href={`/release/${r.slug}`}>
          <span className="rz-feed-cover">{r.cover_url || r.coin_image ? <BlobImg src={r.cover_url || r.coin_image} alt={`${r.title} artwork`} /> : <i>{r.title}</i>}</span>
          <span className="rz-feed-meta">{r.slug === from && <em className="rz-came-tag">You came from here</em>}<small>{r.answers?.project_type === "brand" ? "Brand project" : "Artist project"}</small><b>{r.title}</b></span>
        </a>
      ))}
    </div>
  );
}

type Sample = { kind: "image" | "video" | "audio"; url: string; title?: string };

const safeUrl = (v?: string | null) => {
  if (!v) return null;
  try { const u = new URL(v.startsWith("http") ? v : `https://${v}`); return ["http:", "https:"].includes(u.protocol) ? u.href : null; } catch { return null; }
};
const host = (v: string) => { try { return new URL(v).hostname.replace(/^www\./, ""); } catch { return v; } };

/** Renders remote images through a fetched blob: URL (avoids Chrome blocking remote uploads). */
const blobCache = new Map<string, string>();
function BlobImg({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(blobCache.get(src) ?? null);
  useEffect(() => {
    if (blobCache.has(src)) { setUrl(blobCache.get(src)!); return; }
    if (src.startsWith("/")) { setUrl(src); return; }
    let live = true;
    fetch(src).then((r) => r.blob()).then((b) => {
      const typed = b.type && b.type !== "application/octet-stream" ? b : new Blob([b], { type: "image/jpeg" });
      const u = URL.createObjectURL(typed); blobCache.set(src, u); if (live) setUrl(u);
    }).catch(() => live && setUrl(null));
    return () => { live = false; };
  }, [src]);
  return url ? <img src={url} alt={alt} className={className} loading="lazy" /> : <div className={`${className ?? ""} rz-pf-ph`} aria-label={alt} />;
}

function Avatar({ src, name, className }: { src?: string | null; name: string; className: string }) {
  return src ? <BlobImg src={src} alt={name} className={className} /> : <div className={`${className} rz-pf-initial`}>{(name || "?").charAt(0).toUpperCase()}</div>;
}

function useUser() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [team, setTeam] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user?.id ?? null;
      setUid(id);
      if (id) { const { data: t } = await db.rpc("is_team_member", { _user_id: id }); setTeam(!!t); }
    });
  }, []);
  return { uid, team };
}

function OwnerSettings({ onEdit, editing, visibility }: { onEdit: () => void; editing: boolean; visibility?: { isPublic: boolean; busy: boolean; onChange: (v: boolean) => void } }) {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get("settings") === "1");
  return (
    <div className="rz-settings">
      <button type="button" className="rz-settings-btn" aria-label="Profile settings" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Settings size={17} />
      </button>
      {open && (
        <div className="rz-settings-menu" role="menu">
          <button type="button" className="rz-btn pri" onClick={() => { onEdit(); setOpen(false); }}>{editing ? "Close editor" : "Edit profile"}</button>
          <a className="rz-btn" href="/saved" role="menuitem">Saved</a>
          {visibility && (
            <div className="rz-settings-vis">
              <b>Profile visibility</b>
              <span className="rz-vis" role="group" aria-label="Profile visibility">
                <button className={`rz-btn${visibility.isPublic ? " pri" : ""}`} disabled={visibility.busy} aria-pressed={visibility.isPublic} onClick={() => visibility.onChange(true)}>Public</button>
                <button className={`rz-btn${!visibility.isPublic ? " pri" : ""}`} disabled={visibility.busy} aria-pressed={!visibility.isPublic} onClick={() => visibility.onChange(false)}>Private</button>
              </span>
              <small>{visibility.isPublic ? "Public: shown on Community" : "Private: hidden from Community"}</small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotFound({ what }: { what: string }) {
  return (
    <div className="rz-head"><h1>{what} not found</h1><p>This profile may not be listed yet or the link is wrong.</p>
      <div className="rz-actions"><a className="rz-btn pri" href="/community.html">Back to Community</a></div></div>
  );
}

/* ------------------------------ Talent ------------------------------ */

type Creator = {
  id: string; slug: string; display_name: string; photo_url: string | null; disciplines: string[] | null;
  membership_tier: string | null; hourly_rate_cents: number | null; rating: number | null; bio: string | null;
  website_url: string | null; portfolio_url: string | null; instagram_url: string | null; user_id: string | null;
  work_samples: Sample[] | null; account_kind?: string; is_public?: boolean;
};


export function CreatorProfile({ slug }: { slug: string }) {
  const [c, setC] = useState<Creator | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<Sample | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const { uid, team } = useUser();

  const load = async () => {
    // Wait for the saved session so owners can open their own private profile.
    await supabase.auth.getSession();
    const { data } = await db.from("creator_directory")
      .select("id,slug,display_name,photo_url,disciplines,membership_tier,hourly_rate_cents,rating,bio,website_url,portfolio_url,instagram_url,user_id,work_samples,account_kind,is_public")
      .eq("slug", slug).maybeSingle();
    setC(data ?? null);
    if (data) document.title = `${data.display_name} | Rhozeland Community`;
    if (data) {
      const { data: rs } = await db.from("releases").select("id,slug,title,creator_name,answers,coin_image,cover_url,user_id,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(500);
      const nm = slugify(data.display_name);
      setProjects((rs ?? []).filter((x: any) => (data.user_id && x.user_id === data.user_id) || slugify(x.creator_name || "") === nm));
    }
  };
  useEffect(() => { load(); }, [slug]);

  const isOwner = !!c && !!uid && (c.user_id === uid || team);
  const [visBusy, setVisBusy] = useState(false);
  const setVisibility = async (v: boolean) => {
    if (!c || c.is_public === v) return;
    setVisBusy(true);
    const { error } = await db.rpc("creator_set_visibility", { p_id: c.id, p_public: v });
    setVisBusy(false);
    if (!error) setC({ ...c, is_public: v });
  };
  const rate = c?.hourly_rate_cents != null ? `$${(c.hourly_rate_cents / 100).toLocaleString("en-CA")}/hr` : "Rate on request";
  const ig = safeUrl(c?.instagram_url), web = safeUrl(c?.website_url) || safeUrl(c?.portfolio_url);
  const samples = (c?.work_samples ?? []) as Sample[];
  const fan = c?.account_kind === "supporter";

  return (
    <Shell>
      <div className="rz-card">
        <div className="rz-profile-controls">
          {isOwner && <OwnerSettings editing={editing} onEdit={() => setEditing((e) => !e)} visibility={{ isPublic: c?.is_public !== false, busy: visBusy, onChange: setVisibility }} />}
        </div>
        {c === undefined && <><div className="rz-skel" /><div className="rz-skel" /></>}
        {c === null && <NotFound what="Creator" />}
        {c && (
          <>
            <div className="rz-pf-top">
              <Avatar src={c.photo_url} name={c.display_name} className="rz-pf-photo" />
              <div className="rz-pf-id">
                <h1>{c.display_name}</h1>
                <div className="rz-pf-tags">{(c.disciplines ?? []).map((d) => <span key={d}>{d}</span>)}</div>
                <p className="rz-pf-meta">{!fan && <b>{rate}</b>}{!fan && c.rating != null && " · "}{c.rating != null && <>{Number(c.rating).toFixed(1)} ★</>}</p>
                <ProfileTools kind="creator" slug={c.slug} name={c.display_name} photo={c.photo_url} isOwner={isOwner && c.user_id === uid} />
                {(ig || web) && <div className="rz-pf-actions" style={{ marginTop: ".4rem" }}>
                  {ig && <a className="rz-btn" href={ig} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}
                  {web && <a className="rz-btn" href={web} target="_blank" rel="noopener noreferrer">Website ↗</a>}
                </div>}
              </div>
            </div>

            {editing && isOwner && <CreatorEditor c={c} uid={uid!} onSaved={() => { setEditing(false); load(); }} />}

            <section className="rz-pf-sec"><h2>Bio</h2>
              <p className="rz-pf-bio">{c.bio || "This creator hasn't added a bio yet."}</p></section>

            <section className="rz-pf-sec"><h2>Projects{isOwner && <DraftsLink />}</h2><ProjectGrid rels={projects} /></section>

            {!fan && <section className="rz-pf-sec"><h2>Work samples</h2>
              {samples.length === 0 ? <p className="rz-pf-empty">No work samples yet.</p> : (
                <div className="rz-pf-grid">
                  {samples.map((s, i) => s.kind === "image" ? (
                    <button key={i} type="button" className="rz-pf-tile" onClick={() => setView(s)} aria-label={`Open ${s.title || `work sample ${i + 1}`}`}><BlobImg src={s.url} alt={s.title || `Work sample ${i + 1}`} /></button>
                  ) : embedUrl(s.url) ? (
                    <button key={i} type="button" className="rz-pf-tile rz-pf-link" onClick={() => setView(s)}>
                      <span>{s.kind === "audio" ? "♪" : "▶"}</span><b>{s.title || host(s.url)}</b><small>{s.kind === "audio" ? "Listen" : "Play"}</small>
                    </button>
                  ) : (
                    <a key={i} className="rz-pf-tile rz-pf-link" href={s.url} target="_blank" rel="noopener noreferrer">
                      <span>{s.kind === "audio" ? "♪" : "▶"}</span><b>{s.title || host(s.url)}</b><small>{s.kind === "audio" ? "Listen" : "Watch"} ↗</small>
                    </a>
                  ))}
                </div>
              )}</section>}

            <MoreCreators slug={c.slug} tags={c.disciplines ?? []} Avatar={Avatar} />
          </>
        )}
      </div>
      {view && (
        <Lightbox onClose={() => setView(null)}>
          {view.kind === "image" ? <BlobImg src={view.url} alt={view.title || "Work sample"} className="rz-lightbox-img" />
            : <div className={view.kind === "audio" ? "rz-lightbox-audio" : "rz-lightbox-video"}>
                <iframe src={embedUrl(view.url)!} title={view.title || "Work sample"} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen />
                <a className="rz-link" href={view.url} target="_blank" rel="noopener noreferrer">Open in new tab ↗</a></div>}
        </Lightbox>
      )}
    </Shell>
  );
}

function CreatorEditor({ c, uid, onSaved }: { c: Creator; uid: string; onSaved: () => void }) {
  const [bio, setBio] = useState(c.bio ?? "");
  const [ig, setIg] = useState(c.instagram_url ?? "");
  const [web, setWeb] = useState(c.website_url ?? "");
  const [samples, setSamples] = useState<Sample[]>((c.work_samples ?? []) as Sample[]);
  const [dname, setDname] = useState(c.display_name);
  const [tags, setTags] = useState((c.disciplines ?? []).join(", "));
  const [rateIn, setRateIn] = useState(c.hourly_rate_cents != null ? String(c.hourly_rate_cents / 100) : "");
  const [photo, setPhoto] = useState(c.photo_url ?? "");
  const uploadPhoto = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/") || f.size > 5 * 1024 * 1024) { setNote("Photo must be an image up to 5 MB."); return; }
    setBusy(true);
    const path = `${uid}/photo-${Date.now()}.${f.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, f, { contentType: f.type });
    setBusy(false);
    if (error) { setNote("Upload failed. Please try again."); return; }
    setPhoto(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl); setNote("");
  };
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const addLink = () => {
    const u = safeUrl(link.trim());
    if (!u) { setNote("Paste a full video or audio link."); return; }
    const audio = /soundcloud|spotify|music\.apple|bandcamp|audiomack|\.mp3|\.wav/i.test(u);
    setSamples((s) => [...s, { kind: audio ? "audio" : "video", url: u }]); setLink(""); setNote("");
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setNote("Uploading…");
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/") || f.size > 10 * 1024 * 1024) { setNote("Images only, up to 10 MB each."); continue; }
      const path = `${uid}/samples/${Date.now()}-${f.name.replace(/[^a-z0-9.]+/gi, "-")}`;
      const { error } = await supabase.storage.from("avatars").upload(path, f, { contentType: f.type });
      if (error) { setNote("Upload failed. Please try again."); continue; }
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      setSamples((s) => [...s, { kind: "image", url }]); setNote("");
    }
    setBusy(false);
  };
  const save = async () => {
    const rc = rateIn.trim() === "" ? null : Math.round(Number(rateIn) * 100);
    if (!dname.trim()) { setNote("Please add your name."); return; }
    if (rc !== null && (!Number.isFinite(rc) || rc < 0)) { setNote("Rate should be a number, like 85."); return; }
    setBusy(true);
    const { error: e1 } = await db.rpc("creator_save_details", { p_id: c.id, p_name: dname, p_disciplines: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8), p_rate_cents: rc, p_photo: photo });
    if (e1) { setBusy(false); setNote("Could not save. Please try again."); return; }
    const { error } = await db.rpc("creator_save_profile", { p_id: c.id, p_bio: bio, p_instagram: ig, p_website: web, p_samples: samples });
    setBusy(false);
    if (error) setNote("Could not save. Please try again."); else onSaved();
  };

  return (
    <div className="rz-pf-edit">
      <div className="rz-pf-two">
        <div className="rz-field"><label>Name</label><input className="rz-in" maxLength={100} value={dname} onChange={(e) => setDname(e.target.value)} /></div>
        <div className="rz-field"><label>Hourly rate (CAD)</label><input className="rz-in" inputMode="decimal" placeholder="85" value={rateIn} onChange={(e) => setRateIn(e.target.value)} /></div>
      </div>
      <div className="rz-pf-two">
        <div className="rz-field"><label>Roles</label><input className="rz-in" placeholder="Photographer, Videographer" value={tags} onChange={(e) => setTags(e.target.value)} /></div>
        <div className="rz-field"><label>Photo</label><label className="rz-btn" style={{ cursor: "pointer" }}>{photo ? "Replace photo" : "Upload photo"}<input type="file" accept="image/*" hidden onChange={(e) => uploadPhoto(e.target.files?.[0])} /></label></div>
      </div>
      <div className="rz-field"><label>Bio</label><textarea className="rz-in" value={bio} maxLength={2000} onChange={(e) => setBio(e.target.value)} /></div>
      <div className="rz-pf-two">
        <div className="rz-field"><label>Instagram</label><input className="rz-in" placeholder="https://instagram.com/you" value={ig} onChange={(e) => setIg(e.target.value)} /></div>
        <div className="rz-field"><label>Website</label><input className="rz-in" placeholder="https://yoursite.com" value={web} onChange={(e) => setWeb(e.target.value)} /></div>
      </div>
      <div className="rz-field"><label>Work samples</label>
        <div className="rz-pf-two">
          <input className="rz-in" placeholder="Paste a YouTube, Vimeo, SoundCloud or Spotify link" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLink()} />
          <div style={{ display: "flex", gap: ".4rem" }}>
            <button className="rz-btn" type="button" onClick={addLink}>Add link</button>
            <label className="rz-btn" style={{ cursor: "pointer" }}>Upload images<input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} /></label>
          </div>
        </div>
        {samples.length > 0 && (
          <ul className="rz-pf-slist">
            {samples.map((s, i) => (
              <li key={i}><span>{s.kind === "image" ? "Image" : s.kind === "audio" ? "Audio" : "Video"} · {host(s.url)}</span>
                <button type="button" className="rz-link" onClick={() => setSamples((x) => x.filter((_, j) => j !== i))}>Remove</button></li>
            ))}
          </ul>
        )}
      </div>
      {note && <p className="rz-pf-empty">{note}</p>}
      <div className="rz-actions"><button className="rz-btn pri" disabled={busy} onClick={save}>Save profile</button></div>
    </div>
  );
}

/* ------------------------------ Brand ------------------------------ */

type Brand = { slug: string; name: string; logo_url: string | null; category: string | null; bio: string | null };
type Rel = { id: string; slug: string; title: string; creator_name: string; answers: any; coin_image: string | null; published_at: string };

export function BrandProfile({ slug }: { slug: string }) {
  const [rels, setRels] = useState<Rel[] | undefined>(undefined);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = async () => {
    await supabase.auth.getSession();
    const [{ data: r }, { data: b }, { data: ce }] = await Promise.all([
      db.from("releases").select("id,slug,title,creator_name,answers,coin_image,cover_url,user_id,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(500),
      db.from("brand_profiles").select("slug,name,logo_url,category,bio,user_id").eq("slug", slug).maybeSingle(),
      db.rpc("brand_can_edit", { p_slug: slug }),
    ]);
    const mine = ((r ?? []) as Rel[]).filter((x: any) => slugify(x.creator_name || "") === slug || (b?.user_id && x.user_id === b.user_id));
    setRels(mine); setBrand(b ?? null); setCanEdit(!!ce);
    document.title = `${b?.name || mine[0]?.creator_name || "Brand"} | Rhozeland Community`;
  };
  useEffect(() => { load(); }, [slug]);

  const name = brand?.name || rels?.[0]?.creator_name || "";
  const exists = !!brand || (rels?.length ?? 0) > 0;
  const hiring = (rels ?? []).flatMap((r) =>
    (r.answers?.project_type === "brand" && Array.isArray(r.answers?.roles) ? r.answers.roles : [])
      .map((role: any, i: number) => ({ role, i, r }))
      .filter(({ role }: any) => role && String(role.name || "").trim()));

  return (
    <Shell>
      <div className="rz-card">
        <div className="rz-profile-controls">
          {canEdit && exists && <OwnerSettings editing={editing} onEdit={() => setEditing((e) => !e)} />}
        </div>
        {rels === undefined && <><div className="rz-skel" /><div className="rz-skel" /></>}
        {rels !== undefined && !exists && <NotFound what="Brand" />}
        {rels !== undefined && exists && (
          <>
            <div className="rz-pf-top">
              <Avatar src={brand?.logo_url} name={name} className="rz-pf-photo rz-pf-logo" />
              <div className="rz-pf-id">
                <h1>{name}</h1>
                <div className="rz-pf-tags"><span>{brand?.category || "Brand"}</span></div>
                <p className="rz-pf-bio" style={{ margin: ".4rem 0 .7rem" }}>{brand?.bio || "This brand hasn't added a bio yet."}</p>
                <ProfileTools kind="brand" slug={slug} name={name} photo={brand?.logo_url} isOwner={canEdit}
                  onViewRoles={hiring.length === 1 ? `/release/${hiring[0].r.slug}?apply=${hiring[0].i}` : hiring.length ? "#hiring" : rels[0] ? `/release/${rels[0].slug}` : null} />
              </div>
            </div>

            {editing && canEdit && <BrandEditor slug={slug} initial={{ slug, name, logo_url: brand?.logo_url ?? null, category: brand?.category ?? null, bio: brand?.bio ?? null }} onSaved={() => { setEditing(false); load(); }} />}

            <section className="rz-pf-sec"><h2>Projects{canEdit && <DraftsLink />}</h2>
<ProjectGrid rels={rels} /></section>

            <section className="rz-pf-sec" id="hiring"><h2>Currently hiring</h2>
              {hiring.length === 0 ? <p className="rz-pf-empty">No open roles right now. Check back soon.</p> : (
                <ul className="rz-pf-credits">
                  {hiring.map(({ role, i, r }: any) => (
                    <li key={`${r.id}-${i}`}><a href={`/release/${r.slug}?apply=${i}`}>
                      <b>{role.name}{Number(role.count) > 1 ? ` ×${role.count}` : ""}</b>
                      <span>{r.title}{role.rate ? ` · ${role.rate}` : ""} · Apply ↗</span></a></li>
                  ))}
                </ul>
              )}</section>
          </>
        )}
      </div>
    </Shell>
  );
}

function BrandEditor({ slug, initial, onSaved }: { slug: string; initial: Brand; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Brand) => (e: any) => setF({ ...f, [k]: e.target.value });

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setNote("Logo must be an image up to 5 MB."); return; }
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id; if (!uid) return;
    setBusy(true);
    const path = `${uid}/brand-${slug}-${Date.now()}.${file.name.split(".").pop() || "png"}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) { setNote("Upload failed. Please try again."); return; }
    setF((x) => ({ ...x, logo_url: supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl })); setNote("");
  };
  const save = async () => {
    setBusy(true);
    const { error } = await db.rpc("brand_save_profile", { p_slug: slug, p_name: f.name, p_logo: f.logo_url, p_category: f.category, p_bio: f.bio });
    setBusy(false);
    if (error) setNote("Could not save. Please try again."); else onSaved();
  };

  return (
    <div className="rz-pf-edit">
      <div className="rz-pf-two">
        <div className="rz-field"><label>Brand name</label><input className="rz-in" value={f.name} onChange={set("name")} /></div>
        <div className="rz-field"><label>Category</label><input className="rz-in" placeholder="Fashion, beverage, tech…" value={f.category ?? ""} onChange={set("category")} /></div>
      </div>
      <div className="rz-field"><label>Bio</label><textarea className="rz-in" maxLength={2000} value={f.bio ?? ""} onChange={set("bio")} /></div>
      <div className="rz-field"><label>Logo</label>
        <label className="rz-btn" style={{ cursor: "pointer" }}>{f.logo_url ? "Replace logo" : "Upload logo"}<input type="file" accept="image/*" hidden onChange={(e) => uploadLogo(e.target.files?.[0])} /></label></div>
      {note && <p className="rz-pf-empty">{note}</p>}
      <div className="rz-actions"><button className="rz-btn pri" disabled={busy} onClick={save}>Save profile</button></div>
    </div>
  );
}

/* ------------------------------ /me ------------------------------ */
export function MyProfile() {
  const [state, setState] = useState<"load" | "out" | "pick">("load");
  const [kind, setKind] = useState<"artist" | "brand" | "supporter">("artist");
  const [auth, setAuth] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = (p: any) => location.replace(`/${p.kind}/${p.slug}${new URLSearchParams(location.search).get("settings") === "1" ? "?settings=1" : ""}`);
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return setState("out");
      const { data: p } = await db.rpc("my_profile", {});
      if (p) go(p); else setState("pick");
    });
  }, []);
  const create = async () => {
    setBusy(true); setErr("");
    const { data: p, error } = await db.rpc("my_profile", { p_kind: kind, p_name: name.trim() || null });
    setBusy(false);
    if (error || !p) return setErr("Your profile could not be created. Please try again.");
    go(p);
  };
  return (
    <Shell>
      <div className="rz-card">
        {state === "load" && <div className="rz-skel" />}
        {state === "out" && <div className="rz-head"><h1>Your profile</h1><p>Sign in or create an account as an Artist, Brand or Supporter.</p><div className="rz-actions"><button className="rz-btn pri" onClick={() => setAuth(true)}>Sign in</button></div>
          {auth && <AuthModal action="" redirectTo={location.href} onClose={() => setAuth(false)} onDone={() => location.reload()} />}</div>}
        {state === "pick" && (
          <div className="rz-head"><h1>Set up your profile</h1><p>Choose how you show up on Rhozeland. You can edit everything after.</p>
            <div className="rz-actions" style={{ marginTop: ".8rem" }}>
              {([["artist", "Artist"], ["brand", "Brand"], ["supporter", "Supporter"]] as const).map(([k, l]) => <button key={k} className={`rz-btn${kind === k ? " pri" : ""}`} onClick={() => setKind(k)}>{l}</button>)}
            </div>
            <div className="rz-field" style={{ marginTop: ".8rem" }}><label>{kind === "brand" ? "Brand name" : "Your name"}</label>
              <input className="rz-in" maxLength={100} placeholder="Leave blank to use your account name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            {err && <p className="rz-pf-empty">{err}</p>}
            <div className="rz-actions"><button className="rz-btn pri" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create profile"}</button></div>
          </div>
        )}
      </div>
    </Shell>
  );
}
