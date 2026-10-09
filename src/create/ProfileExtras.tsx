import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "./shared";
import AuthModal from "./AuthModal";

const db = supabase as any;
export type Kind = "creator" | "brand";

export function useSession() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUid(s?.user?.id ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return uid;
}

/** Save, copy link, message and (creators only) invite. */
export function ProfileTools({ kind, slug, name, photo, isOwner, onViewRoles }: {
  kind: Kind; slug: string; name: string; photo?: string | null; isOwner: boolean; onViewRoles?: string | null;
}) {
  const uid = useSession();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [auth, setAuth] = useState<null | "save" | "message" | "invite">(null);
  const [invite, setInvite] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!uid) { setSaved(false); return; }
    db.from("saved_profiles").select("id").eq("profile_kind", kind).eq("profile_slug", slug).maybeSingle()
      .then(({ data }: any) => setSaved(!!data));
  }, [uid, kind, slug]);

  const toggleSave = async () => {
    if (!uid) return setAuth("save");
    if (saved) {
      setSaved(false);
      await db.from("saved_profiles").delete().eq("profile_kind", kind).eq("profile_slug", slug);
    } else {
      setSaved(true);
      const { error } = await db.from("saved_profiles").insert({ user_id: uid, profile_kind: kind, profile_slug: slug, profile_name: name, photo_url: photo ?? null });
      if (error) setSaved(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/${kind}/${slug}`); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const message = async () => {
    if (!uid) return setAuth("message");
    const { data, error } = await db.rpc("dm_open", { p_kind: kind, p_slug: slug });
    if (error) { setNote("Could not open a conversation. Please try again."); return; }
    location.href = `/messages?t=${data}`;
  };
  const doInvite = () => { if (!uid) return setAuth("invite"); setInvite(true); };

  return (
    <>
      <div className="rz-pf-actions">
        {kind === "creator" && <button className="rz-btn pri" onClick={doInvite}>Invite to project</button>}
        {kind === "brand" && <a className="rz-btn pri" href={onViewRoles || "#hiring"}>View open roles</a>}
        {!isOwner && <button className="rz-btn" onClick={message}>Message</button>}
        <button className={`rz-btn rz-pf-icon${saved ? " on" : ""}`} onClick={toggleSave} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save profile"} title={saved ? "Saved" : "Save"}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
          {saved ? "Saved" : "Save"}
        </button>
        <button className="rz-btn" onClick={copy}>{copied ? "Link copied" : "Copy profile link"}</button>
      </div>
      {note && <p className="rz-pf-empty" style={{ marginTop: ".4rem" }}>{note}</p>}
      {auth && (
        <AuthModal action="" redirectTo={location.href} intro={auth === "save" ? "Sign in to save profiles." : auth === "message" ? "Sign in to send a message." : "Sign in to invite creators."}
          onClose={() => setAuth(null)}
          onDone={() => { const a = auth; setAuth(null); setTimeout(() => { if (a === "message") message(); else if (a === "invite") setInvite(true); }, 300); }} />
      )}
      {invite && <InvitePicker slug={slug} name={name} onClose={() => setInvite(false)} />}
    </>
  );
}

function InvitePicker({ slug, name, onClose }: { slug: string; name: string; onClose: () => void }) {
  const [rows, setRows] = useState<any[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    db.rpc("my_releases").then(({ data }: any) => {
      setRows((data ?? []).filter((r: any) => r.status === "published" && r.answers?.project_type === "brand"
        && Array.isArray(r.answers?.roles) && r.answers.roles.some((x: any) => String(x?.name || "").trim())));
    });
  }, []);
  const send = async (r: any, i: number) => {
    setBusy(true);
    const { data: t, error } = await db.rpc("dm_open", { p_kind: "creator", p_slug: slug });
    if (!error) {
      const { data: s } = await supabase.auth.getSession();
      const role = r.answers.roles[i];
      await db.from("dm_messages").insert({ thread_id: t, sender_id: s.session!.user.id,
        body: `Hi ${name}, I'd love you on "${r.title}" as ${role.name}${role.rate ? ` (${role.rate})` : ""}. Apply here: ${location.origin}/release/${r.slug}?apply=${i}` });
      setDone(t);
    }
    setBusy(false);
  };
  return (
    <div className="rz-modal" onClick={() => !busy && onClose()}>
      <div className="rz-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "100%" }}>
        <div className="rz-head"><h1 style={{ fontSize: "1.1rem" }}>Invite {name}</h1><p>Pick a role from one of your published projects.</p></div>
        {rows === undefined && <div className="rz-skel" />}
        {done ? (
          <div className="rz-actions"><p className="rz-pf-empty">Invite sent.</p><a className="rz-btn pri" href={`/messages?t=${done}`}>Open conversation</a><button className="rz-btn" onClick={onClose}>Close</button></div>
        ) : rows && rows.length === 0 ? (
          <><p className="rz-pf-empty">You don't have a published project with open roles yet.</p>
            <div className="rz-actions"><a className="rz-btn pri" href="/create.html?new=1">Start a project</a><button className="rz-btn" onClick={onClose}>Cancel</button></div></>
        ) : rows && (
          <ul className="rz-pf-credits">
            {rows.flatMap((r) => r.answers.roles.map((role: any, i: number) => String(role?.name || "").trim() ? (
              <li key={`${r.id}-${i}`}><button className="rz-pf-pick" disabled={busy} onClick={() => send(r, i)}>
                <b>{role.name}</b><span>{r.title}{role.rate ? ` · ${role.rate}` : ""} · Send invite</span></button></li>
            ) : null))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Work sample viewer ---------------- */
export function embedUrl(u: string): string | null {
  try {
    const x = new URL(u);
    const h = x.hostname.replace(/^www\.|^m\./, "");
    if (h === "youtu.be") return `https://www.youtube.com/embed/${x.pathname.slice(1)}`;
    if (h === "youtube.com") { const v = x.searchParams.get("v") || (x.pathname.match(/\/(shorts|embed)\/([^/]+)/)?.[2]); return v ? `https://www.youtube.com/embed/${v}` : null; }
    if (h === "vimeo.com") { const id = x.pathname.match(/\/(\d+)/)?.[1]; return id ? `https://player.vimeo.com/video/${id}` : null; }
    if (h === "open.spotify.com") return `https://open.spotify.com/embed${x.pathname}`;
    if (h === "soundcloud.com") return `https://w.soundcloud.com/player/?url=${encodeURIComponent(u)}`;
  } catch { /* ignore */ }
  return null;
}

export function Lightbox({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="rz-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="rz-lightbox-x" aria-label="Close" onClick={onClose}>×</button>
      <div className="rz-lightbox-body" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

/* ---------------- More creators like this ---------------- */
export function MoreCreators({ slug, tags, Avatar }: { slug: string; tags: string[]; Avatar: any }) {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    db.from("creator_directory").select("slug,display_name,photo_url,disciplines").neq("slug", slug).limit(200)
      .then(({ data }: any) => {
        const t = tags.map((x) => x.toLowerCase());
        const scored = (data ?? []).map((c: any) => ({ c, n: (c.disciplines ?? []).filter((d: string) => t.includes(d.toLowerCase())).length }))
          .filter((x: any) => x.n > 0).sort((a: any, b: any) => b.n - a.n).slice(0, 4).map((x: any) => x.c);
        setList(scored);
      });
  }, [slug, tags.join("|")]);
  if (!list.length) return null;
  return (
    <section className="rz-pf-sec"><h2>More creators like this</h2>
      <div className="rz-pf-more">
        {list.map((c) => (
          <a key={c.slug} href={`/creator/${c.slug}`}>
            <Avatar src={c.photo_url} name={c.display_name} className="rz-pf-more-img" />
            <b>{c.display_name}</b><small>{(c.disciplines ?? []).slice(0, 2).join(" · ")}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

export const AccountLinks = () => (
  <span style={{ display: "flex", gap: ".8rem" }}>
    <a className="rz-link rz-acct-hide" href="/community.html">Community</a>
    <a className="rz-link" href="/me">My profile</a>
    <a className="rz-link" href="/saved">Saved</a>
    <a className="rz-link" href="/messages">Messages</a>
  </span>
);

function SignInGate({ what }: { what: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rz-head"><h1>{what}</h1><p>Sign in to see this page.</p>
      <div className="rz-actions"><button className="rz-btn pri" onClick={() => setOpen(true)}>Sign in</button></div>
      {open && <AuthModal action="" redirectTo={location.href} onClose={() => setOpen(false)} onDone={() => setOpen(false)} />}
    </div>
  );
}

/* ---------------- /saved ---------------- */
export function SavedPage() {
  const uid = useSession();
  const [rows, setRows] = useState<any[] | undefined>(undefined);
  useEffect(() => {
    document.title = "Saved | Rhozeland";
    if (uid) db.from("saved_profiles").select("*").order("created_at", { ascending: false }).then(({ data }: any) => setRows(data ?? []));
  }, [uid]);
  const remove = async (id: string) => { setRows((r) => r?.filter((x) => x.id !== id)); await db.from("saved_profiles").delete().eq("id", id); };
  return (
    <Shell right={<AccountLinks />}>
      <div className="rz-card">
        {uid === null ? <SignInGate what="Saved" /> : (
          <>
            <div className="rz-head"><h1>Saved</h1><p>Creators and brands you've bookmarked.</p></div>
            {rows === undefined && <div className="rz-skel" />}
            {rows?.length === 0 && <p className="rz-pf-empty">Nothing saved yet. Tap Save on any profile in <a href="/community.html">Community</a>.</p>}
            <ul className="rz-pf-credits">
              {rows?.map((s) => (
                <li key={s.id} className="rz-pf-saved">
                  <a href={`/${s.profile_kind}/${s.profile_slug}`}><b>{s.profile_name || s.profile_slug}</b><span>{s.profile_kind === "brand" ? "Brand" : "Creator"}</span></a>
                  <button className="rz-link" onClick={() => remove(s.id)}>Remove</button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Shell>
  );
}

/* ---------------- /messages ---------------- */
export function MessagesPage() {
  const uid = useSession();
  const [threads, setThreads] = useState<any[] | undefined>(undefined);
  const [active, setActive] = useState<string | null>(new URLSearchParams(location.search).get("t"));
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  const loadThreads = () => db.from("dm_threads").select("*").order("last_at", { ascending: false }).then(({ data }: any) => setThreads(data ?? []));
  const loadMsgs = (t: string) => db.from("dm_messages").select("*").eq("thread_id", t).order("created_at").then(({ data }: any) => setMsgs(data ?? []));

  useEffect(() => { document.title = "Messages | Rhozeland"; if (uid) loadThreads(); }, [uid]);
  useEffect(() => {
    if (!uid || !active) return;
    loadMsgs(active);
    const ch = supabase.channel(`dm-${active}`).on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "dm_messages", filter: `thread_id=eq.${active}` }, () => loadMsgs(active)).subscribe();
    const iv = setInterval(() => loadMsgs(active), 8000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [uid, active]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim(); if (!body || !active || !uid) return;
    setBusy(true);
    const { error } = await db.from("dm_messages").insert({ thread_id: active, sender_id: uid, body });
    setBusy(false);
    if (!error) { setText(""); loadMsgs(active); loadThreads(); }
  };
  const cur = threads?.find((t) => t.id === active);
  const label = (t: any) => t.starter_id === uid ? t.profile_name || t.profile_slug : `About ${t.profile_name || t.profile_slug}`;
  const linkify = (s: string) => s.split(/(https?:\/\/\S+)/g).map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p}>{p}</a> : p);

  return (
    <Shell right={<AccountLinks />}>
      <div className="rz-card">
        {uid === null ? <SignInGate what="Messages" /> : (
          <div className={`rz-dm${active ? " has-active" : ""}`}>
            <aside className="rz-dm-list">
              <h1>Messages</h1>
              {threads === undefined && <div className="rz-skel" />}
              {threads?.length === 0 && <p className="rz-pf-empty">No conversations yet. Tap Message on a profile to start one.</p>}
              {threads?.map((t) => (
                <button key={t.id} className={t.id === active ? "on" : ""} onClick={() => { setActive(t.id); history.replaceState(null, "", `/messages?t=${t.id}`); }}>
                  <b>{label(t)}</b><small>{new Date(t.last_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</small>
                </button>
              ))}
            </aside>
            <section className="rz-dm-thread">
              {!cur ? <p className="rz-pf-empty">Pick a conversation.</p> : (
                <>
                  <header><button className="rz-link rz-dm-back" onClick={() => setActive(null)}>← All</button>
                    <a href={`/${cur.profile_kind}/${cur.profile_slug}`}><b>{label(cur)}</b></a>
                    {!cur.owner_id && <small>This profile isn't claimed yet, so the Rhozeland team will reply.</small>}</header>
                  <div className="rz-dm-msgs">
                    {msgs.length === 0 && <p className="rz-pf-empty">Say hello.</p>}
                    {msgs.map((m) => <p key={m.id} className={m.sender_id === uid ? "me" : ""}>{linkify(m.body)}</p>)}
                    <div ref={end} />
                  </div>
                  <div className="rz-dm-input">
                    <textarea className="rz-in" rows={2} maxLength={4000} placeholder="Write a message" value={text} onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                    <button className="rz-btn pri" disabled={busy || !text.trim()} onClick={send}>Send</button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </Shell>
  );
}
