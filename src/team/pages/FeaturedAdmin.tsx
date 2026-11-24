import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../lib/auth";

const STATUSES = ["submitted","under_review","more_info","approved","in_production","scheduled","published","declined"] as const;
const LABEL: Record<string,string> = { submitted:"Submitted", under_review:"Under review", more_info:"More info needed", approved:"Approved", in_production:"In production", scheduled:"Scheduled", published:"Published", declined:"Declined" };
const db = supabase as any;
type App = Record<string, any>;

function Detail({ app, onSaved }: { app: App; onSaved: () => void }) {
  const [f, setF] = useState<App>({ ...app, scheduled_for: app.scheduled_for?.slice(0,16) || "" });
  const [imgs, setImgs] = useState<string[]>([]);
  const [notes, setNotes] = useState<App[]>([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const loadNotes = async () => { const { data } = await db.from("featured_application_notes").select("*").eq("application_id", app.id).order("created_at"); setNotes(data || []); };
  useEffect(() => {
    void loadNotes();
    const paths = [app.primary_image, ...(app.images || [])].filter(Boolean);
    supabase.storage.from("featured-submissions").createSignedUrls(paths, 3600).then(({ data }) => setImgs((data || []).map((d: any) => d.signedUrl).filter(Boolean)));
  }, [app.id]);
  const save = async () => {
    setMsg("");
    const { error } = await db.from("featured_applications").update({
      status: f.status, info_request: f.info_request || null, decision_message: f.decision_message || null,
      scheduled_for: f.scheduled_for ? new Date(f.scheduled_for).toISOString() : null,
      published_at: f.status === "published" ? (app.published_at || new Date().toISOString()) : app.published_at,
      instagram_url: f.instagram_url || null, facebook_url: f.facebook_url || null,
    }).eq("id", app.id);
    setMsg(error ? "Couldn't save. Try again." : "Saved."); if (!error) onSaved();
  };
  const addNote = async () => { if (!note.trim()) return; const { error } = await db.from("featured_application_notes").insert({ application_id: app.id, body: note.trim() }); if (!error) { setNote(""); void loadNotes(); } };
  const input = "w-full rounded-md border border-border bg-background p-2 text-sm";
  return <div className="space-y-4 border-t border-border p-4">
    <div className="flex gap-2 overflow-x-auto">{imgs.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-28 w-28 rounded-md object-cover" /></a>)}</div>
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div><dt className="text-muted-foreground">Description</dt><dd>{app.description}</dd></div>
      <div><dt className="text-muted-foreground">Why feature them</dt><dd>{app.pitch}</dd></div>
      <div><dt className="text-muted-foreground">Instagram</dt><dd>{app.instagram}</dd></div>
      <div><dt className="text-muted-foreground">Links</dt><dd className="break-all">{[app.website, app.main_link, ...(app.extra_links||[]), app.video_link].filter(Boolean).map((l: string) => <a key={l} href={l} target="_blank" rel="noreferrer" className="block underline">{l}</a>)}</dd></div>
      {Object.entries(app.details || {}).map(([k,v]) => <div key={k}><dt className="text-muted-foreground capitalize">{k.replace(/_/g," ")}</dt><dd>{String(v)}</dd></div>)}
      {app.applicant_reply && <div className="sm:col-span-2"><dt className="text-muted-foreground">Applicant's reply</dt><dd>{app.applicant_reply}</dd></div>}
    </dl>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Status<select className={input} value={f.status} onChange={e => setF({ ...f, status: e.target.value })}>{STATUSES.map(s => <option key={s} value={s}>{LABEL[s]}</option>)}</select></label>
      <label className="text-sm">Scheduled for<input type="datetime-local" className={input} value={f.scheduled_for} onChange={e => setF({ ...f, scheduled_for: e.target.value })} /></label>
      <label className="text-sm sm:col-span-2">Request for more info (applicant sees this)<textarea className={input} rows={2} value={f.info_request || ""} onChange={e => setF({ ...f, info_request: e.target.value })} /></label>
      <label className="text-sm sm:col-span-2">Approval or decline message (applicant sees this)<textarea className={input} rows={2} value={f.decision_message || ""} onChange={e => setF({ ...f, decision_message: e.target.value })} /></label>
      <label className="text-sm">Instagram post link<input className={input} value={f.instagram_url || ""} onChange={e => setF({ ...f, instagram_url: e.target.value })} /></label>
      <label className="text-sm">Facebook post link<input className={input} value={f.facebook_url || ""} onChange={e => setF({ ...f, facebook_url: e.target.value })} /></label>
    </div>
    <div className="flex items-center gap-3"><Button onClick={save}>Save</Button>{msg && <span className="text-sm" role="status">{msg}</span>}</div>
    <div className="space-y-2"><h3 className="text-sm font-medium">Private team notes</h3>
      {notes.map(n => <p key={n.id} className="rounded-md bg-muted p-2 text-sm">{n.body}<span className="block text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span></p>)}
      <div className="flex gap-2"><input className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note only the team sees" /><Button variant="outline" onClick={addNote}>Add</Button></div>
    </div>
  </div>;
}

export default function FeaturedAdmin() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<App[]>([]), [open, setOpen] = useState(""), [filter, setFilter] = useState("all"), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const load = async () => { if (!isAdmin) return; setLoading(true); setError(""); const { data, error } = await db.from("featured_applications").select("*").order("created_at", { ascending: false }); if (error) setError("Applications couldn't load. Try again."); else setRows(data || []); setLoading(false); };
  useEffect(() => { void load(); }, [isAdmin]);
  if (!isAdmin) return <p>Get Featured applications are available to admins only.</p>;
  const shown = filter === "all" ? rows : rows.filter(r => r.status === filter);
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Get Featured</h1><p className="text-sm text-muted-foreground">{rows.length} applications</p></div>
      <div className="flex gap-2"><select aria-label="Filter by status" className="rounded-md border border-border bg-background p-2 text-sm" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{LABEL[s]}</option>)}</select><Button variant="outline" onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw size={16} /></Button></div>
    </header>
    {error && <p role="alert">{error}</p>}
    {loading ? <p>Loading…</p> : !shown.length ? <p>No applications yet.</p> :
      <ul className="divide-y divide-border rounded-lg border border-border">{shown.map(r => <li key={r.id}>
        <button className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-accent" onClick={() => setOpen(open === r.id ? "" : r.id)}>
          <span><span className="font-medium">{r.name}</span> <span className="text-sm capitalize text-muted-foreground">· {r.category} · {new Date(r.created_at).toLocaleDateString()}</span></span>
          <span className="rounded-full bg-muted px-2 py-1 text-xs">{LABEL[r.status]}</span>
        </button>
        {open === r.id && <Detail app={r} onSaved={load} />}
      </li>)}</ul>}
  </section>;
}
