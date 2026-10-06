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
import { FileAudio, LockKeyhole, Pin, Plus } from "lucide-react";
import "./exclusive.css";

type Post = { id: string; body: string; media_kind: "image" | "video" | null; media_url: string | null; created_at: string; local?: boolean };

const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

// Render media through blob: URLs so Chrome never blocks remote uploads.
function BlobMedia({ url, kind }: { url: string; kind: "image" | "video" }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let u = "", off = false;
    if (url.startsWith("blob:")) { setSrc(url); return; }
    fetch(url).then((r) => r.blob()).then((b) => {
      if (off) return;
      const typed = b.type && b.type !== "application/octet-stream" ? b : new Blob([b], { type: kind === "image" ? "image/jpeg" : "video/mp4" });
      u = URL.createObjectURL(typed); setSrc(u);
    }).catch(() => {});
    return () => { off = true; if (u) URL.revokeObjectURL(u); };
  }, [url, kind]);
  if (!src) return <div className="rz-skel" style={{ aspectRatio: "16/9", marginTop: ".6rem" }} />;
  return kind === "image"
    ? <img className="rz-post-media" src={src} alt="" />
    : <video className="rz-post-media" src={src} controls playsInline />;
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

  useEffect(() => {
    (supabase.from as any)("releases").select("id,title,creator_name,coin_mint,coin_ticker,cover_url,user_id")
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
    let kind: "image" | "video" | null = null;
    if (file) {
      if (file.type.startsWith("image/")) kind = "image"; else if (file.type.startsWith("video/")) kind = "video";
      else return setErr("Please choose an image or video.");
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
              <h1>Exclusive feed</h1>
              <p>Updates, stems and files from {r.creator_name || "the creator"}, for people who hold {tk}.</p>
            </div>

            <div className="rz-board-grid" aria-label="Project mood board">
              {isOwner && <Button variant="outline" className="rz-board-tile rz-board-add" onClick={() => { setErr(""); setFormOpen(true); }}><Plus aria-hidden="true" /><span>Add content</span></Button>}
              <article className="rz-board-tile">
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
                <article className="rz-board-tile" key={p.id}>
                  {p.media_url && p.media_kind && <div className="rz-board-media"><BlobMedia url={p.media_url} kind={p.media_kind} /></div>}
                  <div className="rz-board-caption"><p>{p.body}</p><small>{fmtDate(p.created_at)} · Holders only</small></div>
                </article>
              ))}
              {!unlocked && <article className="rz-board-tile rz-board-locked" aria-label="Locked holder updates">
                <div className="rz-board-media rz-board-cover">
                  <div className="rz-board-blur" aria-hidden="true">{r.cover_url ? <BlobMedia url={r.cover_url} kind="image" /> : <div className="rz-board-art"><Pin /></div>}</div>
                  <div className="rz-board-lock-overlay"><span><LockKeyhole size={20} aria-hidden="true" /></span>Holders only</div>
                </div>
                <div className="rz-board-caption"><b>Holder updates</b><p>Hold {tk} to open exclusive content.</p></div>
              </article>}
              <article className={`rz-board-tile ${unlocked ? "" : "rz-board-locked"}`}>
                <div className="rz-board-media">
                  <div className={`rz-board-art rz-board-files ${unlocked ? "" : "rz-board-blur"}`} aria-hidden="true"><FileAudio /></div>
                  {!unlocked && <div className="rz-board-lock-overlay"><span><LockKeyhole size={20} aria-hidden="true" /></span>Holders only</div>}
                </div>
                <div className="rz-board-caption"><b>Stems and project files</b><p>{unlocked ? "Unlocked. The creator will share files here." : `Hold ${tk} to unlock.`}</p></div>
              </article>
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

      {formOpen && (
        <div className="rz-modal" onClick={() => !busy && setFormOpen(false)}>
          <div className="rz-card" style={{ maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}><h1 style={{ fontSize: "1.2rem" }}>Post update</h1><p>Only holders of {tk} will see this.</p></div>
            <div className="rz-field"><label>Update</label><textarea className="rz-in" maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="What's new with the project?" /></div>
            <div className="rz-field" style={{ marginTop: ".7rem" }}>
              <label>Image or video <span className="rz-opt">(optional)</span></label>
              <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
