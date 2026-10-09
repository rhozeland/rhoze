import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BriefcaseBusiness, FileText, MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import "./messages.css";

const db = supabase as any;
type Message = { id: string; thread_id: string; sender_id: string; body: string; created_at: string };
type Person = { user_id: string; slug: string; display_name: string; photo_url: string | null; disciplines: string[] };
type Thread = { id: string; starter_id: string; owner_id: string | null; profile_kind: string; profile_slug: string; profile_name: string; last_at: string; person?: Person; latest?: Message; personal: boolean };
type Application = { id: string; release_id: string; role_name: string; role_index: number; name: string; link: string; description: string; files: { name: string; url: string; kind?: string }[]; status: string; created_at: string; updated_at: string; project_title: string; project_slug: string; brand_name: string; is_owner: boolean; applicant_user_id: string | null; profile_slug: string | null; photo_url: string | null; skills: string[] };
const statusLabel = (s: string) => ({ applied: "Submitted", hired: "Accepted", submitted: "Submitted", under_review: "Under Review", accepted: "Accepted", rejected: "Rejected" }[s] || s.replace(/_/g, " "));
const date = (s: string) => new Date(s).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
const stamp = (s: string) => new Date(s).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
export const isApplicationMessage = (body: string) => /^Application: [^\n]+\nName: /.test(body);
const safeLink = (s?: string | null) => { try { const u = new URL(s || ""); return ["https:", "http:"].includes(u.protocol) ? u.href : null; } catch { return null; } };

function Photo({ src, name }: { src?: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null); if (!src) return;
    let live = true; let blobUrl: string | undefined;
    fetch(src).then(r => { if (!r.ok) throw new Error("photo unavailable"); return r.blob(); }).then(b => {
      blobUrl = URL.createObjectURL(b.type === "application/octet-stream" ? new Blob([b], { type: "image/jpeg" }) : b);
      if (live) setUrl(blobUrl); else URL.revokeObjectURL(blobUrl);
    }).catch(() => {});
    return () => { live = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [src]);
  return <span className="rz-inbox-photo">{url ? <img src={url} alt={name} /> : name.slice(0, 1).toUpperCase() || "?"}</span>;
}

function Empty({ title, text, browse }: { title: string; text: string; browse?: "roles" | "people" }) {
  return <div className="rz-inbox-empty"><span className="rz-inbox-empty-icon">{browse === "people" ? <MessageCircle /> : <BriefcaseBusiness />}</span><h2>{title}</h2><p>{text}</p>{browse && <Button asChild variant="outline" className="rz-btn"><a href={browse === "roles" ? "/community.html?view=open-calls" : "/community.html"}>{browse === "roles" ? "Browse open roles" : "Browse profiles"}</a></Button>}</div>;
}

export default function MessagesInbox({ uid }: { uid: string }) {
  const params = new URLSearchParams(location.search);
  const [tab, setTab] = useState(["applications", "applicants"].includes(params.get("tab") || "") ? params.get("tab") || "messages" : "messages");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string | null>(params.get("t"));
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [read, setRead] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(`rz-dm-read:${uid}`) || "{}"); } catch { return {}; } });
  const end = useRef<HTMLDivElement>(null);
  const markRead = useCallback((id: string, time: string) => setRead(old => { const next = { ...old, [id]: time }; localStorage.setItem(`rz-dm-read:${uid}`, JSON.stringify(next)); return next; }), [uid]);

  const load = useCallback(async () => {
    const [tr, ar] = await Promise.all([db.from("dm_threads").select("*").order("last_at", { ascending: false }), db.rpc("my_application_inbox")]);
    if (tr.error || ar.error) { setError("Could not load your inbox. Please try again."); setLoading(false); return; }
    const rows: Thread[] = tr.data || [];
    let messages: Message[] = [];
    if (rows.length) {
      const result = await db.from("dm_messages").select("*").in("thread_id", rows.map(t => t.id)).order("created_at", { ascending: false });
      if (result.error) { setError("Could not load conversations. Please try again."); setLoading(false); return; }
      messages = result.data || [];
    }
    const ids = [...new Set(rows.map(t => t.starter_id === uid ? t.owner_id : t.starter_id).filter(Boolean))];
    const pr = ids.length ? await db.from("creator_directory").select("user_id,slug,display_name,photo_url,disciplines").in("user_id", ids) : { data: [] };
    const people: Person[] = pr.data || [];
    setThreads(rows.map(t => { const tm = messages.filter(m => m.thread_id === t.id); return { ...t, person: people.find(p => p.user_id === (t.starter_id === uid ? t.owner_id : t.starter_id)), latest: tm[0], personal: !tm.length || tm.some(m => !isApplicationMessage(m.body)) }; }));
    setApplications(ar.data || []); setLoading(false); setError("");
  }, [uid]);

  useEffect(() => { document.title = "Messages | Rhozeland"; load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); }, [load]);
  useEffect(() => {
    setMsgs([]); if (!active) return;
    let live = true; setMessageLoading(true);
    const refresh = async () => {
      const { data, error: e } = await db.from("dm_messages").select("*").eq("thread_id", active).order("created_at");
      if (!live) return;
      setMessageLoading(false);
      if (e) { setError("Could not load this conversation."); return; }
      setMsgs(data || []);
      const last = data?.[data.length - 1]; if (last) markRead(active, last.created_at);
    };
    refresh();
    const channel = supabase.channel(`inbox-${active}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${active}` }, refresh).subscribe();
    const iv = setInterval(refresh, 8000);
    return () => { live = false; clearInterval(iv); supabase.removeChannel(channel); };
  }, [active, markRead]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);

  const openChat = (id: string) => { setActive(id); setTab("messages"); setText(""); history.replaceState(null, "", `/messages?t=${id}`); };
  const switchTab = (v: string) => { setTab(v); setActive(null); history.replaceState(null, "", v === "messages" ? "/messages" : `/messages?tab=${v}`); };
  const send = async () => {
    const body = text.trim(); if (!body || !active || busy) return;
    setBusy(true); const result = await db.from("dm_messages").insert({ thread_id: active, sender_id: uid, body }).select().single(); setBusy(false);
    if (result.error) { setError("Message not sent. Please try again."); return; }
    setText(""); setMsgs(old => old.some(m => m.id === result.data.id) ? old : [...old, result.data]); markRead(active, result.data.created_at); load();
  };
  const startConversation = async (a: Application) => {
    setBusy(true); const { data, error: e } = await db.rpc("application_start_conversation", { p_application_id: a.id }); setBusy(false);
    if (e) { setError(a.applicant_user_id ? "Could not open a conversation. Please try again." : "This application has no linked account. Contact the applicant through their portfolio, if provided."); return; }
    await load(); setSelected(null); openChat(data);
  };
  const updateStatus = async (a: Application, status: string) => {
    setBusy(true); const { error: e } = await db.rpc("release_set_application_status", { p_token: null, p_app_id: a.id, p_status: status }); setBusy(false);
    if (e) { setError("Could not update the application. Please try again."); return; }
    const updated = { ...a, status, updated_at: new Date().toISOString() }; setSelected(updated); await load();
  };
  const personal = threads.filter(t => t.personal || t.id === active);
  const mine = applications.filter(a => a.applicant_user_id === uid);
  const received = applications.filter(a => a.is_owner && a.applicant_user_id !== uid);
  const current = threads.find(t => t.id === active);
  const name = (t: Thread) => t.person?.display_name || (t.starter_id === uid ? t.profile_name : "Member");
  const profileHref = (t: Thread) => t.person ? `/creator/${t.person.slug}` : t.starter_id === uid ? `/${t.profile_kind}/${t.profile_slug}` : null;
  const grouped = received.reduce<Record<string, Application[]>>((out, a) => { const key = `${a.release_id}:${a.role_index}`; (out[key] ||= []).push(a); return out; }, {});
  const row = (a: Application, owner: boolean) => <article key={a.id} className="rz-application-row">
    {owner && <Photo src={a.photo_url} name={a.name} />}
    <div className="rz-application-copy"><h3>{owner ? a.name : a.role_name}</h3><p>{owner ? a.role_name : a.project_title}{a.brand_name && !owner ? ` · ${a.brand_name}` : ""}</p>{owner && a.skills?.length > 0 && <small>{a.skills.join(" · ")}</small>}<small>Applied {date(a.created_at)}</small>{owner && safeLink(a.link) && <a href={safeLink(a.link) || undefined} target="_blank" rel="noopener noreferrer">Portfolio ↗</a>}</div>
    <div className="rz-application-actions"><span className={`rz-application-status s-${a.status}`}>{statusLabel(a.status)}</span><Button variant="outline" className="rz-btn" onClick={() => { setError(""); setSelected(a); }}>{owner ? "Review application" : "View details"}</Button>{owner && a.profile_slug && <a href={`/creator/${a.profile_slug}`}>View profile</a>}{owner && a.applicant_user_id && <Button variant="ghost" className="rz-inbox-text-button" disabled={busy} onClick={() => startConversation(a)}>Message</Button>}</div>
  </article>;

  return <div className="rz-inbox">
    <header className="rz-inbox-heading"><h1>Messages</h1></header>
    <Tabs value={tab} onValueChange={switchTab}>
      <TabsList className="rz-inbox-tabs" aria-label="Inbox views">
        <TabsTrigger value="messages"><MessageCircle size={15} />Messages{personal.length > 0 && <span>{personal.length}</span>}</TabsTrigger>
        <TabsTrigger value="applications"><FileText size={15} />My Applications{mine.length > 0 && <span>{mine.length}</span>}</TabsTrigger>
        <TabsTrigger value="applicants"><BriefcaseBusiness size={15} />Applicants{received.length > 0 && <span>{received.length}</span>}</TabsTrigger>
      </TabsList>
      {error && <div role="alert" className="rz-inbox-error">{error}<Button variant="ghost" className="rz-inbox-text-button" onClick={load}>Retry</Button></div>}
      {loading ? <p role="status" className="rz-inbox-loading">Loading your inbox…</p> : <>
        <TabsContent value="messages">
          {!personal.length ? <Empty title="No conversations yet" text="Your personal conversations will appear here." browse="people" /> : <div className={`rz-inbox-chat${active ? " has-active" : ""}`}>
            <aside className="rz-inbox-conversations" aria-label="Conversations">{personal.map(t => { const unread = t.latest && t.latest.sender_id !== uid && (!read[t.id] || t.latest.created_at > read[t.id]) && t.id !== active; return <Button variant="ghost" key={t.id} className={`rz-conversation${t.id === active ? " on" : ""}`} onClick={() => openChat(t.id)} aria-label={`${name(t)}${unread ? ", unread" : ""}`}>
              <Photo src={t.person?.photo_url} name={name(t)} /><span className="rz-conversation-copy"><b>{name(t)}</b><small>{t.latest ? (isApplicationMessage(t.latest.body) ? "Application submitted" : t.latest.body) : "New conversation"}</small></span><span className="rz-conversation-meta"><time dateTime={t.latest?.created_at || t.last_at}>{stamp(t.latest?.created_at || t.last_at)}</time>{unread && <i aria-label="Unread" />}</span>
            </Button>; })}</aside>
            <section className="rz-inbox-thread" aria-label="Chat">{!current ? <Empty title="Your conversations" text="Select a conversation to open it." browse="people" /> : <>
              <header><Button variant="ghost" className="rz-inbox-back" aria-label="All conversations" onClick={() => { setActive(null); history.replaceState(null, "", "/messages"); }}><ArrowLeft size={16} /></Button><Photo src={current.person?.photo_url} name={name(current)} /><div>{profileHref(current) ? <a href={profileHref(current) || undefined}>{name(current)}</a> : <b>{name(current)}</b>}{!current.owner_id && <small>The Rhozeland team will reply.</small>}</div></header>
              <div className="rz-inbox-bubbles" aria-live="polite">{messageLoading ? <p className="rz-inbox-loading">Loading conversation…</p> : !msgs.length ? <p className="rz-inbox-loading">Say hello.</p> : msgs.map(m => <div key={m.id} className={`rz-inbox-bubble${m.sender_id === uid ? " me" : ""}`}><p>{m.body.split(/(https?:\/\/\S+)/g).map((s, i) => safeLink(s) ? <a key={i} href={safeLink(s) || undefined} target="_blank" rel="noopener noreferrer">{s}</a> : s)}</p><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}</time></div>)}<div ref={end} /></div>
              <form className="rz-inbox-compose" onSubmit={e => { e.preventDefault(); send(); }}><textarea aria-label="Write a message" placeholder="Write a message" rows={2} maxLength={4000} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><Button type="submit" variant="outline" className="rz-btn rz-inbox-send" disabled={busy || !text.trim()} aria-label="Send message" title="Send message"><Send size={17} /></Button></form>
            </>}</section>
          </div>}
        </TabsContent>
        <TabsContent value="applications">{!mine.length ? <Empty title="No applications yet" text="Find a role that fits your work and submit your first application." browse="roles" /> : <section aria-label="My applications">{mine.map(a => row(a, false))}</section>}</TabsContent>
        <TabsContent value="applicants">{!received.length ? <Empty title="No applicants yet" text="Applications to your open roles will appear here once someone applies." /> : Object.entries(grouped).map(([key, group]) => <section className="rz-applicant-group" key={key}><header><a href={`/release/${group[0].project_slug}`}>{group[0].project_title}</a><h2>{group[0].role_name} <span>{group.length}</span></h2></header>{group.map(a => row(a, true))}</section>)}</TabsContent>
      </>}
    </Tabs>
    <Dialog open={!!selected} onOpenChange={v => { if (!v) setSelected(null); }}><DialogContent className="rz-application-dialog">{selected && <>
      <DialogTitle>{selected.role_name}</DialogTitle><DialogDescription>{selected.project_title} · {selected.brand_name}</DialogDescription>
      <div className="rz-application-detail-person"><Photo src={selected.photo_url} name={selected.name} /><div><b>{selected.name}</b><small>Applied {date(selected.created_at)}</small></div><span className={`rz-application-status s-${selected.status}`}>{statusLabel(selected.status)}</span></div>
      <section><h3>Description or inquiry</h3><p className="rz-application-description">{selected.description}</p></section>
      {safeLink(selected.link) && <a href={safeLink(selected.link) || undefined} target="_blank" rel="noopener noreferrer">Portfolio ↗</a>}
      {selected.profile_slug && <a href={`/creator/${selected.profile_slug}`}>View applicant profile</a>}
      {selected.skills?.length > 0 && <p>{selected.skills.join(" · ")}</p>}
      {selected.files?.length > 0 && <section><h3>Attachments</h3><ul>{selected.files.map((f, i) => safeLink(f.url) ? <li key={i}><a href={safeLink(f.url) || undefined} target="_blank" rel="noopener noreferrer">{f.name || `Attachment ${i + 1}`} ↗</a></li> : null)}</ul></section>}
      <section><h3>Latest update</h3><p>{statusLabel(selected.status)} · {date(selected.updated_at || selected.created_at)}</p></section>
      {error && <p role="alert" className="rz-inbox-error">{error}</p>}
      <div className="rz-application-detail-actions">{selected.is_owner && <Button variant="outline" className="rz-btn" disabled={busy} onClick={() => updateStatus(selected, selected.status === "hired" ? "applied" : "hired")}>{busy ? "Saving…" : selected.status === "hired" ? "Mark submitted" : "Accept application"}</Button>}{selected.applicant_user_id && <Button variant="outline" className="rz-btn" disabled={busy} onClick={() => startConversation(selected)}><MessageCircle size={15} />Message</Button>}</div>
    </>}</DialogContent></Dialog>
  </div>;
}