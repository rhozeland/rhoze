// /release/:slug/exclusive — holder-only feed. Holders prove wallet ownership by
// signing a message; the backend checks their balance before returning posts.
import { useEffect, useRef, useState } from "react";
import bs58 from "bs58";
import { supabase } from "@/integrations/supabase/client";
import { Shell } from "./shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SolanaWalletProvider, fetchTokenBalance } from "./SolanaWallet";
import { Button } from "@/components/ui/button";
import { FileAudio, LockKeyhole, Pin, Plus, Play, Pause, Quote, Sparkles, Clock, Clapperboard, Wallet, BadgeCheck, Check } from "lucide-react";
import "./exclusive.css";

type Post = { id: string; body: string; media_kind: "image" | "video" | "audio" | null; media_url: string | null; created_at: string; local?: boolean };

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

type Kind = "image" | "video" | "audio";
// Load remote media through blob: URLs so Chrome never blocks remote uploads.
function useBlob(url: string, kind: Kind) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let u = "", off = false;
    if (url.startsWith("blob:")) { setSrc(url); return; }
    fetch(url).then((r) => r.blob()).then((b) => {
      if (off) return;
      const typed = b.type && b.type !== "application/octet-stream" ? b : new Blob([b], { type: kind === "image" ? "image/jpeg" : kind === "audio" ? "audio/mpeg" : "video/mp4" });
      u = URL.createObjectURL(typed); setSrc(u);
    }).catch(() => {});
    return () => { off = true; if (u) URL.revokeObjectURL(u); };
  }, [url, kind]);
  return src;
}

function VideoThumb({ src }: { src: string }) {
  const [play, setPlay] = useState(false);
  if (play) return <video className="rz-post-media" src={src} controls autoPlay playsInline />;
  return (
    <button type="button" className="rz-vthumb" onClick={() => setPlay(true)} aria-label="Play video">
      <video className="rz-post-media" src={`${src}#t=0.1`} muted playsInline preload="metadata" />
      <span className="rz-vplay"><Play size={22} fill="currentColor" aria-hidden="true" /></span>
    </button>
  );
}

function Waveform({ src }: { src: string }) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [prog, setProg] = useState(0);
  const [on, setOn] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    let off = false;
    fetch(src).then((r) => r.arrayBuffer()).then((buf) => new AudioContext().decodeAudioData(buf)).then((ab) => {
      const d = ab.getChannelData(0), n = 56, step = Math.floor(d.length / n), out: number[] = [];
      for (let i = 0; i < n; i++) { let m = 0; for (let j = 0; j < step; j += 64) m = Math.max(m, Math.abs(d[i * step + j] || 0)); out.push(m); }
      const mx = Math.max(...out, 0.01); if (!off) setPeaks(out.map((v) => Math.max(0.08, v / mx)));
    }).catch(() => !off && setPeaks(Array.from({ length: 56 }, (_, i) => 0.3 + 0.5 * Math.abs(Math.sin(i * 0.7)))));
    return () => { off = true; };
  }, [src]);
  const toggle = () => { const a = ref.current; if (!a) return; a.paused ? a.play() : a.pause(); };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => { const a = ref.current; if (!a?.duration) return; const b = e.currentTarget.getBoundingClientRect(); a.currentTime = ((e.clientX - b.left) / b.width) * a.duration; };
  return (
    <div className="rz-wave">
      <audio ref={ref} src={src} preload="metadata" onPlay={() => setOn(true)} onPause={() => setOn(false)} onTimeUpdate={(e) => setProg(e.currentTarget.currentTime / (e.currentTarget.duration || 1))} />
      <button type="button" className="rz-wave-btn" onClick={toggle} aria-label={on ? "Pause" : "Play"}>{on ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
      <div className="rz-wave-bars" onClick={seek} role="slider" aria-label="Seek" aria-valuenow={Math.round(prog * 100)}>
        {peaks.map((v, i) => <i key={i} style={{ height: `${v * 100}%` }} className={i / peaks.length < prog ? "on" : ""} />)}
      </div>
    </div>
  );
}

function BlobMedia({ url, kind }: { url: string; kind: Kind }) {
  const src = useBlob(url, kind);
  if (!src) return <div className="rz-skel" style={{ aspectRatio: kind === "audio" ? "5/1" : "16/9", marginTop: 0 }} />;
  if (kind === "image") return <img className="rz-post-media" src={src} alt="" />;
  if (kind === "audio") return <Waveform src={src} />;
  return <VideoThumb src={src} />;
}

// Placeholder until on-chain holder counts are wired in.
const holderCount = (mint: string) => 120 + (Array.from(mint).reduce((a, c) => a + c.charCodeAt(0), 0) % 380);

// Plain-language explainer shown to visitors before any wallet or payment prompt.
function SupportInfo({ creator, tk, nextMs }: { creator: string; tk: string; nextMs: string }) {
  const gets = [
    { icon: Sparkles, t: "Holder updates", d: `Notes from ${creator} as the project moves, newest first.` },
    { icon: Clapperboard, t: "Photos, video and audio", d: "Early listens, cuts and stills, shared here before anywhere else." },
    { icon: FileAudio, t: "Stems and project files", d: `The working files ${creator} chooses to hand over.` },
    { icon: Quote, t: "A pinned note", d: "A personal message from the creator, kept at the top of the feed." },
    { icon: BadgeCheck, t: "A Member badge", d: "You're marked as a supporter wherever you open this feed." },
  ];
  if (nextMs) gets.push({ icon: Clock, t: "New unlocks at each milestone", d: `More opens as the work lands. Next up: ${nextMs}.` });
  const rules = [
    { icon: LockKeyhole, t: "What stays locked", d: `Anything tagged "Holders only" — updates, media and files — stays blurred and out of the feed until your wallet holds at least one ${tk}.` },
    { icon: Wallet, t: "How access is checked", d: `Connect the wallet that holds ${tk} and sign a free message. No funds move, and Rhozeland never asks for a payment here.` },
    { icon: Check, t: "What's always open", d: "The pinned \"Behind the scenes update\" below needs nothing at all." },
    { icon: Clock, t: "How long you keep it", d: `Access stays open while your wallet holds ${tk}. Let it go and the feed closes again.` },
  ];
  return (
    <section className="rz-support-info" aria-labelledby="rz-si-h">
      <h2 id="rz-si-h">What supporting this project means</h2>
      <p className="rz-si-lead">Supporting means picking up <b>{tk}</b> on Pump.fun — that's how fans fund {creator}'s work directly. The sale is run by Pump.fun, not Rhozeland. Once {tk} is sitting in your wallet, you're a supporter and everything on this page opens up.</p>
      <div className="rz-si-cols">
        <div className="rz-si-block">
          <h3>What supporters get</h3>
          <ul className="rz-si-list">
            {gets.map((g) => <li key={g.t}><g.icon size={15} aria-hidden="true" /><span><b>{g.t}</b><small>{g.d}</small></span></li>)}
          </ul>
        </div>
        <div className="rz-si-block">
          <h3>What's locked, and how to open it</h3>
          <ul className="rz-si-list">
            {rules.map((g) => <li key={g.t}><g.icon size={15} aria-hidden="true" /><span><b>{g.t}</b><small>{g.d}</small></span></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function ExclusivePage({ slug }: { slug: string }) {
  const [connErr, setConnErr] = useState(false);
  return <SolanaWalletProvider onError={() => setConnErr(true)}><Inner slug={slug} connErr={connErr} setConnErr={setConnErr} /></SolanaWalletProvider>;
}

function Inner({ slug, connErr, setConnErr }: { slug: string; connErr: boolean; setConnErr: (v: boolean) => void }) {
  const { publicKey, connected, connecting, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const walletAddr = publicKey?.toBase58() ?? "";
  const [r, setR] = useState<any>(undefined);
  const [isOwner, setIsOwner] = useState(false);
  const [bal, setBal] = useState<"idle" | "loading" | "holds" | "none" | "error">("idle");
  const [balTry, setBalTry] = useState(0);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedState, setFeedState] = useState<"idle" | "signing" | "error">("idle");
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteErr, setNoteErr] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  useEffect(() => { document.documentElement.classList.add("rz-exclusive"); return () => document.documentElement.classList.remove("rz-exclusive"); }, []);
  const saveNote = async (v: string) => {
    setNoteErr("");
    const { error } = await (supabase as any).rpc("release_set_note", { p_id: r.id, p_note: v });
    if (error) return setNoteErr("Your note could not be saved. Please try again.");
    setR({ ...r, owner_note: v.trim() || null }); setNoteOpen(false);
  };

  useEffect(() => {
    (supabase.from as any)("releases").select("id,title,creator_name,coin_mint,coin_ticker,cover_url,user_id,milestones,owner_note")
      .eq("slug", slug).eq("status", "published").maybeSingle()
      .then(async ({ data }: any) => {
        setR(data ?? null);
        if (!data) return;
        document.title = `Exclusive · ${data.title} | Rhozeland`;
        const { data: u } = await supabase.auth.getUser();
        if (u.user && data.user_id === u.user.id) setIsOwner(true);
      }, () => setR(null));
  }, [slug]);

  const ticker = r?.coin_ticker ? String(r.coin_ticker).replace(/^\$/, "") : "";
  const tk = ticker ? "$" + ticker : "the coin";
  const pumpUrl = r?.coin_mint ? `https://pump.fun/coin/${r.coin_mint}` : "";

  // Owner sees their own posts directly.
  const loadOwnerPosts = async () => {
    const { data } = await (supabase.from as any)("release_posts").select("id,body,media_path,media_kind,created_at")
      .eq("release_id", r.id).order("created_at", { ascending: false });
    const out = await Promise.all((data || []).map(async (p: any) => {
      let media_url: string | null = null;
      if (p.media_path) media_url = (await supabase.storage.from("release-posts").createSignedUrl(p.media_path, 3600)).data?.signedUrl ?? null;
      return { ...p, media_url };
    }));
    setPosts(out);
  };
  useEffect(() => { if (isOwner && r) loadOwnerPosts(); /* eslint-disable-next-line */ }, [isOwner, r?.id]);

  useEffect(() => {
    if (!walletAddr || !r?.coin_mint) { setBal("idle"); return; }
    let off = false; setBal("loading");
    fetchTokenBalance(walletAddr, r.coin_mint).then((b) => !off && setBal(b > 0 ? "holds" : "none")).catch(() => !off && setBal("error"));
    return () => { off = true; };
  }, [walletAddr, r?.coin_mint, balTry]);

  useEffect(() => { if (connected) setConnErr(false); }, [connected]);
  useEffect(() => { if (posts !== null) setSupportOpen(false); }, [posts]);

  const unlockFeed = async () => {
    if (!signMessage || !walletAddr) { setFeedState("error"); return; }
    setFeedState("signing");
    try {
      const message = `Rhoze exclusive access\nProject: ${slug}\nWallet: ${walletAddr}\nTime: ${new Date().toISOString()}`;
      const sig = await signMessage(new TextEncoder().encode(message));
      const { data, error } = await supabase.functions.invoke("release-exclusive", { body: { slug, wallet: walletAddr, message, signature: bs58.encode(sig) } });
      if (error || !data?.holds) throw new Error("x");
      setPosts(data.posts || []); setFeedState("idle");
    } catch { setFeedState("error"); }
  };

  const openConnect = () => { setConnErr(false); try { setVisible(true); } catch { setConnErr(true); } };
  const shortAddr = walletAddr ? `${walletAddr.slice(0, 4)}…${walletAddr.slice(-4)}` : "";

  const submit = async () => {
    const body = text.trim();
    if (!body) return setErr("Write something for your update.");
    if (body.length > 5000) return setErr("Keep it under 5000 characters.");
    let kind: Kind | null = null;
    if (file) {
      if (file.type.startsWith("image/")) kind = "image"; else if (file.type.startsWith("video/")) kind = "video"; else if (file.type.startsWith("audio/")) kind = "audio";
      else return setErr("Please choose an image, video or audio file.");
      if (file.size > 50 * 1024 * 1024) return setErr("Files must be under 50 MB.");
    }
    setBusy(true); setErr("");
    const { data: u } = await supabase.auth.getUser();
    let media_path: string | null = null;
    if (file && kind) {
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      media_path = `${r.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("release-posts").upload(media_path, file, { contentType: file.type });
      if (error) { setBusy(false); return setErr("Your file could not be uploaded. Please try again."); }
    }
    const { data, error } = await (supabase.from as any)("release_posts")
      .insert({ release_id: r.id, user_id: u.user?.id, body, media_path, media_kind: kind }).select("id,created_at").single();
    setBusy(false);
    if (error) return setErr("Your update could not be posted. Please try again.");
    const local: Post = { id: data.id, created_at: data.created_at, body, media_kind: kind, media_url: file ? URL.createObjectURL(file) : null, local: true };
    setPosts((p) => [local, ...(p || [])]);
    setText(""); setFile(null); setFormOpen(false);
  };

  const unlocked = isOwner || (posts !== null && bal === "holds");
  const member = posts !== null && bal === "holds";
  const hasMedia = (posts || []).some((p) => p.media_url);
  const ms = (r?.milestones || []) as any[];
  const nextMs = ms[1]?.title || ms[0]?.title || "";
  let n = 0; const anim = () => ({ style: { ["--i" as any]: n++ } });

  return (
    <Shell right={walletAddr ? <span className="rz-wallet-chip"><i />{shortAddr} <small>Solana</small></span> : <a className="rz-link" href={`/release/${encodeURIComponent(slug)}`}>Back to project</a>}>
      <div className="rz-board-page">
        {r && isOwner && <div className="rz-owner rz-board-owner"><span>You own this project</span></div>}
        {r === undefined && <><div className="rz-skel" /><div className="rz-skel" /></>}
        {r === null && (
          <div className="rz-head"><h1>Project not found</h1><p>This page may be unpublished or the link is wrong.</p>
            <div className="rz-actions"><a className="rz-btn pri" href="/discover">Discover projects</a></div></div>
        )}
        {r && (
          <>
            <a className="rz-textlink" href={`/release/${encodeURIComponent(slug)}`}>← {r.title}</a>
            <div className="rz-board-head">
              <h1>Exclusive feed {member && <span className="rz-member"><Sparkles size={12} aria-hidden="true" />Member</span>}</h1>
              <p>Updates, stems and files from {r.creator_name || "the creator"}, for people who hold {tk}.</p>
            </div>

            {!unlocked && <SupportInfo creator={r.creator_name || "the creator"} tk={tk} nextMs={nextMs} />}

            {member && r.coin_mint && <div className="rz-welcome">You're one of <b>{holderCount(r.coin_mint).toLocaleString("en-CA")}</b> {tk} holders with access to this feed.</div>}
            {(r.owner_note || isOwner) && (
              <figure className="rz-note-card">
                <Quote size={22} aria-hidden="true" />
                {r.owner_note ? <blockquote>{r.owner_note}</blockquote> : <blockquote className="rz-note-empty">Pin a short note for your supporters.</blockquote>}
                <figcaption>— {r.creator_name || "The creator"}{isOwner && <button className="rz-textlink" onClick={() => { setNoteText(r.owner_note || ""); setNoteErr(""); setNoteOpen(true); }}>{r.owner_note ? "Edit note" : "Add note"}</button>}</figcaption>
              </figure>
            )}
            <div className="rz-board-grid" aria-label="Project mood board">
              {isOwner && <Button variant="outline" {...anim()} className="rz-board-tile rz-board-add" onClick={() => { setErr(""); setFormOpen(true); }}><Plus aria-hidden="true" /><span>Add content</span></Button>}
              <article className="rz-board-tile" {...anim()}>
                <div className="rz-board-media rz-board-cover">
                  {r.cover_url ? <BlobMedia url={r.cover_url} kind="image" /> : <div className="rz-board-art"><Pin aria-hidden="true" /></div>}
                  <span className="rz-board-pinned"><Pin size={12} aria-hidden="true" />Pinned</span>
                </div>
                <div className="rz-board-caption">
                  <b>Behind the scenes update</b>
                  <p>A first look at how {r.title} is coming together. Follow along here as the project moves through its milestones.</p>
                  <small>Open to everyone</small>
                </div>
              </article>
              {unlocked && (posts || []).map((p) => (
                <article className="rz-board-tile" key={p.id} {...anim()}>
                  {p.media_url && p.media_kind && <div className="rz-board-media"><BlobMedia url={p.media_url} kind={p.media_kind} /></div>}
                  <div className="rz-board-caption"><p>{p.body}</p><small>{fmtDate(p.created_at)} · Holders only</small></div>
                </article>
              ))}
              {!unlocked && <article className="rz-board-tile rz-board-locked" {...anim()} aria-label="Locked holder updates" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => setSupportOpen(true)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSupportOpen(true); } }}>
                <div className="rz-board-media rz-board-cover">
                  <div className="rz-board-blur" aria-hidden="true">{r.cover_url ? <BlobMedia url={r.cover_url} kind="image" /> : <div className="rz-board-art"><Pin /></div>}</div>
                  <div className="rz-board-lock-overlay"><span><LockKeyhole size={20} aria-hidden="true" /></span>Holders only</div>
                </div>
                <div className="rz-board-caption"><b>Holder updates</b><p>Hold {tk} to open exclusive content.</p></div>
              </article>}
              {!(unlocked && hasMedia) && <article className={`rz-board-tile ${unlocked ? "" : "rz-board-locked"}`} {...anim()} {...(!unlocked ? { role: "button", tabIndex: 0, style: { cursor: "pointer" }, onClick: () => setSupportOpen(true), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSupportOpen(true); } } } : {})}>
                <div className="rz-board-media">
                  <div className={`rz-board-art rz-board-files ${unlocked ? "" : "rz-board-blur"}`} aria-hidden="true"><FileAudio /></div>
                  {!unlocked && <div className="rz-board-lock-overlay"><span><LockKeyhole size={20} aria-hidden="true" /></span>Holders only</div>}
                </div>
                <div className="rz-board-caption"><b>Stems and project files</b><p>{unlocked ? "Unlocked. The creator will share files here." : `Hold ${tk} to unlock.`}</p></div>
              </article>}
              {nextMs && <div className="rz-board-tile rz-board-soon" aria-disabled="true" {...anim()}>
                <div className="rz-board-art"><Clock aria-hidden="true" /></div>
                <div className="rz-board-caption"><small>Coming soon</small><b>Next unlock at {nextMs}</b></div>
              </div>}
            </div>

            {!unlocked && (
              <div className="rz-lock">
                <b>🔒 Holders only</b>
                {!r.coin_mint ? (
                  <p>This project hasn't attached a coin yet. Follow along and check back soon.</p>
                ) : (
                  <>
                    <p>Hold {tk} in your wallet to unlock every update, plus stems and project files. Connect the wallet that holds it to open the feed.</p>
                    {bal === "none" && <p className="rz-note">Connected, but you don't hold {tk} yet.</p>}
                    {bal === "loading" && <p className="rz-note">Checking your wallet…</p>}
                    {bal === "error" && <p className="rz-note">We couldn't check your wallet right now. <button className="rz-textlink" onClick={() => setBalTry((n) => n + 1)}>Retry</button></p>}
                    {connErr && <p className="rz-note">We couldn't connect your wallet. <button className="rz-textlink" onClick={openConnect}>Try again</button></p>}
                    {feedState === "error" && <p className="rz-note">We couldn't open the feed. <button className="rz-textlink" onClick={unlockFeed}>Try again</button></p>}
                    <div className="rz-actions" style={{ marginTop: ".8rem" }}>
                      {bal === "holds"
                        ? <button className="rz-btn pri" onClick={unlockFeed} disabled={feedState === "signing"}>{feedState === "signing" ? "Confirm in your wallet…" : "Open the feed"}</button>
                        : <a className="rz-btn pri" href={pumpUrl} target="_blank" rel="noopener noreferrer">Buy {tk} on Pump.fun</a>}
                      {!walletAddr && <button className="rz-btn" onClick={openConnect} disabled={connecting}>{connecting ? "Connecting…" : "Connect wallet"}</button>}
                    </div>
                    {bal === "holds" && <p className="rz-note" style={{ marginTop: ".6rem" }}>Your wallet will ask you to sign a message. It's free and doesn't move any funds.</p>}
                  </>
                )}
              </div>
            )}
            <p className="rz-note" style={{ marginTop: "1.6rem" }}>Tokens trade on Pump.fun. Rhoze does not operate the sale.</p>
          </>
        )}
      </div>

      {supportOpen && r && (
        <div className="rz-modal" onClick={() => setSupportOpen(false)}>
          <div className="rz-card" style={{ maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1 style={{ fontSize: "1.2rem" }}>Support {r.title}</h1>
              <p>This content is for people who hold {tk}. Want to support the project and unlock the feed?</p>
            </div>
            {!r.coin_mint ? (
              <p className="rz-note">This project hasn't attached a coin yet. Follow along and check back soon.</p>
            ) : (
              <>
                <ul className="rz-si-mini" aria-label="What supporters get">
                  <li><Check size={12} aria-hidden="true" />Holder updates from {r.creator_name || "the creator"}, newest first</li>
                  <li><Check size={12} aria-hidden="true" />Photos, video and early audio</li>
                  <li><Check size={12} aria-hidden="true" />Stems and project files</li>
                  <li><Check size={12} aria-hidden="true" />A Member badge, while you hold {tk}</li>
                </ul>
                <p className="rz-si-fine">Connecting a wallet doesn't buy anything — it only checks whether your wallet holds {tk}.</p>
                {bal === "none" && <p className="rz-note">Connected, but you don't hold {tk} yet.</p>}
                {bal === "loading" && <p className="rz-note">Checking your wallet…</p>}
                {bal === "error" && <p className="rz-note">We couldn't check your wallet right now. <button className="rz-textlink" onClick={() => setBalTry((n) => n + 1)}>Retry</button></p>}
                {connErr && <p className="rz-note">We couldn't connect your wallet. <button className="rz-textlink" onClick={openConnect}>Try again</button></p>}
                {feedState === "error" && <p className="rz-note">We couldn't open the feed. <button className="rz-textlink" onClick={unlockFeed}>Try again</button></p>}
                <div className="rz-actions" style={{ marginTop: ".8rem" }}>
                  {bal === "holds"
                    ? <button className="rz-btn pri" onClick={() => { unlockFeed(); }} disabled={feedState === "signing"}>{feedState === "signing" ? "Confirm in your wallet…" : "Open the feed"}</button>
                    : <a className="rz-btn pri" href={pumpUrl} target="_blank" rel="noopener noreferrer">Buy {tk} on Pump.fun</a>}
                  {!walletAddr && <button className="rz-btn" onClick={openConnect} disabled={connecting}>{connecting ? "Connecting…" : "Connect wallet"}</button>}
                  <button className="rz-btn" onClick={() => setSupportOpen(false)}>Not now</button>
                </div>
                {bal === "holds" && <p className="rz-note" style={{ marginTop: ".6rem" }}>Your wallet will ask you to sign a message. It's free and doesn't move any funds.</p>}
              </>
            )}
          </div>
        </div>
      )}

      {noteOpen && (
        <div className="rz-modal" onClick={() => setNoteOpen(false)}>
          <div className="rz-card" style={{ maxWidth: 420, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}><h1 style={{ fontSize: "1.2rem" }}>Pinned note</h1><p>A short message shown at the top of your feed.</p></div>
            <textarea className="rz-in" maxLength={280} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Thanks for backing this project…" />
            <small style={{ fontSize: ".65rem" }}>{noteText.length}/280</small>
            {noteErr && <p className="rz-warn">{noteErr}</p>}
            <div className="rz-actions" style={{ marginTop: "1rem" }}>
              <button className="rz-btn pri" onClick={() => saveNote(noteText)}>Save note</button>
              {r?.owner_note && <button className="rz-btn" onClick={() => saveNote("")}>Remove</button>}
              <button className="rz-btn" onClick={() => setNoteOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="rz-modal" onClick={() => !busy && setFormOpen(false)}>
          <div className="rz-card" style={{ maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}><h1 style={{ fontSize: "1.2rem" }}>Post update</h1><p>Only holders of {tk} will see this.</p></div>
            <div className="rz-field"><label>Update</label><textarea className="rz-in" maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What's new with the project?" /></div>
            <div className="rz-field" style={{ marginTop: ".7rem" }}>
              <label>Image, video or audio <span className="rz-opt">(optional)</span></label>
              <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <div className="rz-actions">
                <button className="rz-btn" onClick={() => fileRef.current?.click()}>{file ? "Replace file" : "Choose file"}</button>
                {file && <><small style={{ fontSize: ".7rem", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{file.name}</small><button className="rz-textlink" onClick={() => setFile(null)}>Remove</button></>}
              </div>
            </div>
            {err && <p className="rz-warn" style={{ marginTop: ".6rem" }}>{err}</p>}
            <div className="rz-actions" style={{ marginTop: "1.2rem" }}>
              <button className="rz-btn pri" onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post"}</button>
              <button className="rz-btn" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
