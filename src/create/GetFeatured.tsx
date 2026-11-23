import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "./shared";
import AuthModal from "./AuthModal";
import { useSession } from "./ProfileExtras";
import { FEATURED_CATEGORIES, CATEGORY_FIELDS, STATUS_LABELS, MAX_SUPPORTING, aboutError, contentError, type FeaturedCategory, type FeaturedStatus } from "./featured";
import "./get-featured.css";

const db = supabase as any;
const BUCKET = "featured-submissions";
const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

/* ---------------- /get-featured ---------------- */
export function GetFeaturedPage() {
  const uid = useSession();
  const [applying, setApplying] = useState(false);
  const [auth, setAuth] = useState(false);
  const [done, setDone] = useState(false);
  const [featured, setFeatured] = useState<{ name: string; category: string; instagram_url: string | null; facebook_url: string | null }[]>([]);
  useEffect(() => {
    document.title = "Get Featured | Rhozeland";
    db.rpc("featured_published").then(({ data }: any) => setFeatured(data ?? []));
  }, []);
  const apply = () => { setDone(false); if (uid) setApplying(true); else setAuth(true); };

  return (
    <Shell>
      <div className="rz-card">
        {done ? (
          <div className="rz-head"><h1>Application sent</h1><p>Thanks. Our team will review it, and you can follow its status in <a href="/submissions">My submissions</a>.</p>
            <div className="rz-actions"><a className="rz-btn pri" href="/submissions">View my submissions</a></div></div>
        ) : applying && uid ? (
          <ApplyForm uid={uid} onCancel={() => setApplying(false)} onDone={() => { setApplying(false); setDone(true); }} />
        ) : (
          <>
            <div className="gf-hero"><h1>Your work deserves to be discovered.</h1>
              <p>Submit your work for a chance to be featured by Rhozeland. We're always looking to discover independent artists, emerging brands and creative talent.</p></div>
            <div className="gf-cats">{FEATURED_CATEGORIES.map((c) => <div key={c.id} className="gf-cat"><b>{c.title}</b><small>{c.desc}</small></div>)}</div>
            <div className="gf-sec"><h2>How it works</h2>
              <ol className="gf-steps"><li>Submit your work.</li><li>Our team reviews your application.</li><li>Selected submissions are prepared for promotion.</li><li>Get featured on Rhozeland's social platforms.</li></ol>
              <div className="rz-actions"><button className="rz-btn pri" onClick={apply}>Apply to Get Featured</button>{uid && <a className="rz-btn" href="/submissions">My submissions</a>}</div>
              <p className="gf-fine">Free to apply. All submissions are reviewed. Selection is not guaranteed.</p>
            </div>
            {featured.length > 0 && <div className="gf-sec"><h2>Recently featured</h2>
              <div className="gf-featured">{featured.map((f, i) => <a key={i} className="rz-chip" href={f.instagram_url || f.facebook_url || "#"} target="_blank" rel="noreferrer">{f.name}<small>{f.category}</small></a>)}</div></div>}
          </>
        )}
        {auth && <AuthModal action=" and apply" intro="Create an account or log in to apply to Get Featured." redirectTo={location.href} onClose={() => setAuth(false)} onDone={() => { setAuth(false); setApplying(true); }} />}
      </div>
    </Shell>
  );
}

type Pic = { file: File; url: string };
function ApplyForm({ uid, onCancel, onDone }: { uid: string; onCancel: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<FeaturedCategory | null>(null);
  const [f, setF] = useState({ name: "", description: "", instagram: "", website: "", main_link: "", extra_links: [""], pitch: "" });
  const [details, setDetails] = useState<Record<string, string>>({});
  const [primary, setPrimary] = useState<Pic | null>(null);
  const [supporting, setSupporting] = useState<Pic[]>([]);
  const [video, setVideo] = useState("");
  const [ownership, setOwnership] = useState(false);
  const [promotion, setPromotion] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const primaryIn = useRef<HTMLInputElement>(null), suppIn = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const pick = (files: FileList | null) => Array.from(files ?? []).filter((x) => OK_TYPES.includes(x.type) && x.size <= 10 * 1024 * 1024).map((file) => ({ file, url: URL.createObjectURL(file) }));
  const cat = FEATURED_CATEGORIES.find((c) => c.id === category);

  const next = () => {
    setErr("");
    if (step === 0 && !category) return setErr("Pick a category.");
    if (step === 1) { const e = aboutError(f); if (e) return setErr(e); }
    setStep(step + 1);
  };
  const submit = async () => {
    const e = contentError({ primary: !!primary, supporting: supporting.length, video, ownership, promotion });
    if (e) return setErr(e);
    setBusy(true); setErr("");
    try {
      const up = async (p: Pic) => {
        const ext = p.file.type === "image/png" ? "png" : p.file.type === "image/webp" ? "webp" : "jpg";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, p.file, { contentType: p.file.type });
        if (error) throw new Error("An image couldn't upload. Try a smaller JPG, PNG or WebP.");
        return path;
      };
      const primaryPath = await up(primary!);
      const imgs = []; for (const p of supporting) imgs.push(await up(p));
      const { error } = await db.from("featured_applications").insert({
        user_id: uid, category, name: f.name.trim(), description: f.description.trim(), instagram: f.instagram.trim(),
        website: f.website.trim() || null, main_link: f.main_link.trim(), extra_links: f.extra_links.map((l) => l.trim()).filter(Boolean),
        pitch: f.pitch.trim(), details, primary_image: primaryPath, images: imgs, video_link: video.trim() || null,
        consent_ownership: ownership, consent_promotion: promotion,
      });
      if (error) throw new Error("Your application couldn't be saved. Please try again.");
      onDone();
    } catch (x: any) { setErr(x?.message || "Something went wrong. Please try again."); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="rz-head"><h1>Apply to Get Featured</h1><p>Step {step + 1} of 3 · {["Category", "About your work", "Supporting content"][step]}</p></div>
      {step === 0 && <div className="gf-cats">{FEATURED_CATEGORIES.map((c) => (
        <button key={c.id} type="button" aria-pressed={category === c.id} className={`gf-cat ${category === c.id ? "on" : ""}`} onClick={() => setCategory(c.id)}><b>{c.title.replace(/s$/, "")}</b><small>{c.desc}</small></button>
      ))}</div>}
      {step === 1 && cat && <div className="gf-form">
        <div className="rz-field"><label>{cat.nameLabel}</label><input className="rz-in" maxLength={120} value={f.name} onChange={set("name")} /></div>
        <div className="rz-field"><label>Short description</label><textarea className="rz-in" maxLength={1000} value={f.description} onChange={set("description")} /></div>
        {CATEGORY_FIELDS[cat.id].map((q) => <div key={q.key} className="rz-field"><label>{q.label} <span className="rz-opt">(optional)</span></label><input className="rz-in" maxLength={120} placeholder={q.placeholder} value={details[q.key] || ""} onChange={(e) => setDetails({ ...details, [q.key]: e.target.value })} /></div>)}
        <div className="rz-field"><label>Instagram profile</label><input className="rz-in" maxLength={200} placeholder="@yourname or link" value={f.instagram} onChange={set("instagram")} /></div>
        <div className="rz-field"><label>Website <span className="rz-opt">(optional)</span></label><input className="rz-in" maxLength={300} placeholder="https://" value={f.website} onChange={set("website")} /></div>
        <div className="rz-field"><label>Main project or content link</label><input className="rz-in" maxLength={500} placeholder="https://" value={f.main_link} onChange={set("main_link")} /></div>
        <div className="rz-field"><label>Additional links <span className="rz-opt">(optional)</span></label>
          {f.extra_links.map((l, i) => <input key={i} className="rz-in" style={{ marginBottom: ".35rem" }} maxLength={500} placeholder="https://" value={l} onChange={(e) => { const a = [...f.extra_links]; a[i] = e.target.value; setF({ ...f, extra_links: a }); }} />)}
          {f.extra_links.length < 5 && <button type="button" className="rz-link" onClick={() => setF({ ...f, extra_links: [...f.extra_links, ""] })}>+ Add another link</button>}</div>
        <div className="rz-field"><label>Why should Rhozeland feature your work?</label><textarea className="rz-in" maxLength={1500} value={f.pitch} onChange={set("pitch")} /></div>
      </div>}
      {step === 2 && <div className="gf-form">
        <div className="rz-field"><label>Primary image</label>
          <div className="gf-thumbs">{primary ? <div className="gf-thumb"><img src={primary.url} alt="Primary" /><button type="button" aria-label="Remove primary image" onClick={() => setPrimary(null)}>×</button></div>
            : <button type="button" className="gf-add" onClick={() => primaryIn.current?.click()}>+ Add image</button>}</div>
          <input ref={primaryIn} type="file" hidden accept={OK_TYPES.join(",")} onChange={(e) => { const p = pick(e.target.files)[0]; if (p) setPrimary(p); e.target.value = ""; }} /></div>
        <div className="rz-field"><label>Supporting images <span className="rz-opt">(optional, up to {MAX_SUPPORTING})</span></label>
          <div className="gf-thumbs">{supporting.map((p, i) => <div key={p.url} className="gf-thumb"><img src={p.url} alt={`Supporting ${i + 1}`} /><button type="button" aria-label="Remove image" onClick={() => setSupporting(supporting.filter((_, j) => j !== i))}>×</button></div>)}
            {supporting.length < MAX_SUPPORTING && <button type="button" className="gf-add" onClick={() => suppIn.current?.click()}>+ Add</button>}</div>
          <input ref={suppIn} type="file" hidden multiple accept={OK_TYPES.join(",")} onChange={(e) => { setSupporting([...supporting, ...pick(e.target.files)].slice(0, MAX_SUPPORTING)); e.target.value = ""; }} /></div>
        <div className="rz-field"><label>Video link <span className="rz-opt">(optional)</span></label><input className="rz-in" maxLength={500} placeholder="https://" value={video} onChange={(e) => setVideo(e.target.value)} /></div>
        <label className="gf-check"><input type="checkbox" checked={ownership} onChange={(e) => setOwnership(e.target.checked)} />I own this work or have permission to share it, including the images and links above.</label>
        <label className="gf-check"><input type="checkbox" checked={promotion} onChange={(e) => setPromotion(e.target.checked)} />If selected, Rhozeland may post this work and my name on its Instagram and Facebook, with credit to me.</label>
        <p className="gf-fine">Applications are free. Submission does not guarantee selection or publication.</p>
      </div>}
      {err && <p className="rz-err" role="alert">{err}</p>}
      <div className="rz-actions">
        <button type="button" className="rz-btn" disabled={busy} onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>{step === 0 ? "Cancel" : "Back"}</button>
        {step < 2 ? <button type="button" className="rz-btn pri" onClick={next}>Next</button>
          : <button type="button" className="rz-btn pri" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit Application"}</button>}
      </div>
    </div>
  );
}

/* ---------------- /submissions (account area) ---------------- */
type Sub = { id: string; name: string; category: string; status: FeaturedStatus; created_at: string; info_request: string | null; applicant_reply: string | null; decision_message: string | null; scheduled_for: string | null; published_at: string | null; instagram_url: string | null; facebook_url: string | null };
export function MySubmissionsPage() {
  const uid = useSession();
  const [rows, setRows] = useState<Sub[] | undefined>(undefined);
  const [auth, setAuth] = useState(false);
  const load = () => db.from("featured_applications").select("id,name,category,status,created_at,info_request,applicant_reply,decision_message,scheduled_for,published_at,instagram_url,facebook_url").eq("user_id", uid).order("created_at", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => { document.title = "My submissions | Rhozeland"; if (uid) load(); }, [uid]);
  return (
    <Shell>
      <div className="rz-card">
        {uid === null ? <div className="rz-head"><h1>My submissions</h1><p>Sign in to see your Get Featured applications.</p><div className="rz-actions"><button className="rz-btn pri" onClick={() => setAuth(true)}>Sign in</button></div></div> : <>
          <div className="rz-head"><h1>My submissions</h1><p>Your Get Featured applications and where they stand.</p></div>
          {rows === undefined && <div className="rz-skel" />}
          {rows?.length === 0 && <p className="rz-pf-empty">No applications yet. <a href="/get-featured">Apply to Get Featured</a>.</p>}
          <ul className="gf-subs">{rows?.map((s) => <SubCard key={s.id} s={s} onChange={load} />)}</ul>
          {!!rows?.length && <div className="rz-actions"><a className="rz-btn" href="/get-featured">Submit another</a></div>}
        </>}
        {auth && <AuthModal action="" redirectTo={location.href} onClose={() => setAuth(false)} onDone={() => setAuth(false)} />}
      </div>
    </Shell>
  );
}
function SubCard({ s, onChange }: { s: Sub; onChange: () => void }) {
  const [reply, setReply] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const send = async () => { setBusy(true); setErr(""); const { error } = await db.rpc("featured_reply", { p_id: s.id, p_reply: reply }); setBusy(false); if (error) setErr("Your reply couldn't be sent. Please try again."); else onChange(); };
  return (
    <li className="gf-sub">
      <header><div><b>{s.name}</b><br /><small>{s.category[0].toUpperCase() + s.category.slice(1)} · sent {new Date(s.created_at).toLocaleDateString()}</small></div>
        <span className={`gf-badge ${s.status}`}>{STATUS_LABELS[s.status]}</span></header>
      {s.status === "more_info" && s.info_request && <div><p><b>The team asked:</b> {s.info_request}</p>
        <textarea className="rz-in" style={{ marginTop: ".4rem" }} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your answer" />
        <div className="rz-actions"><button className="rz-btn pri" disabled={busy || !reply.trim()} onClick={send}>{busy ? "Sending…" : "Send reply"}</button></div>
        {err && <p className="rz-err">{err}</p>}</div>}
      {s.status !== "more_info" && s.applicant_reply && <p><small>Your reply: {s.applicant_reply}</small></p>}
      {s.decision_message && <p>{s.decision_message}</p>}
      {s.status === "scheduled" && s.scheduled_for && <p>Scheduled for {new Date(s.scheduled_for).toLocaleDateString()}.</p>}
      {(s.instagram_url || s.facebook_url) && <div className="gf-links">{s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noreferrer">View on Instagram</a>}{s.facebook_url && <a href={s.facebook_url} target="_blank" rel="noreferrer">View on Facebook</a>}</div>}
    </li>
  );
}
