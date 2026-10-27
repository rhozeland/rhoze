import ProjectMedia from "./ProjectMedia";
import { PublicTeasers } from "./ProjectContent";
import { parseMediaLinks } from "./project-media";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, money } from "./shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SolanaWalletProvider, fetchTokenBalance } from "./SolanaWallet";
import ReleasePrice from "./ReleasePrice";
import { ProjectHeart } from "./ProjectLikes";
import ProjectWorkspace, { DEFAULT_PUBLIC_SECTIONS } from "./ProjectWorkspace";
import { ProjectMetricsBadges } from "./ProjectMetrics";
import { Button } from "@/components/ui/button";
import { X, Share2, Fingerprint } from "lucide-react";
import ProjectDiscussion from "./ProjectDiscussion";
import ProjectStory from "./ProjectStory";
import ProjectRewards from "./ProjectRewards";
import RelatedProjects from "./RelatedProjects";
import './leaderboard.css';
import './board.css';
import './release-dark.css';
import { hasOpenRoles } from './project-flow';
import { openRoleTarget } from './release-navigation';
import RoleDetails from './RoleDetails';
import PublicProjectCanvas from './PublicProjectCanvas';
import { ExclusiveFeed } from './ExclusivePage';

type Status = "Upcoming" | "Funded" | "Delivered";
const CAUSE_WALLET = "Cz4P…w2Lb";

const firstSentence = (t?: string) => {
  if (!t) return "";
  const m = t.trim().match(/^[^.!?]*[.!?]/);
  return (m ? m[0] : t).trim();
};

export default function ReleasePage({ slug }: { slug: string }) {
  const [connErr, setConnErr] = useState(false);
  return <SolanaWalletProvider onError={() => setConnErr(true)}><ReleaseInner slug={slug} connErr={connErr} setConnErr={setConnErr} /></SolanaWalletProvider>;
}

function ReleaseInner({ slug, connErr, setConnErr }: { slug: string; connErr: boolean; setConnErr: (v: boolean) => void }) {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [balState, setBalState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [balTry, setBalTry] = useState(0);
  const [r, setR] = useState<any>(undefined);
  const [isOwner, setIsOwner] = useState(false);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [tab, setTab] = useState<"board" | "overview" | "roadmap" | "people" | "budget" | "unlocks" | "exclusive">(new URLSearchParams(location.search).get('tab') === 'exclusive' || location.hash === '#exclusive' ? 'exclusive' : 'board');
  const [workspaceTab, setWorkspaceTab] = useState<string>(new URLSearchParams(location.search).get('tab') === 'exclusive' || location.hash === '#exclusive' ? 'exclusive' : new URLSearchParams(location.search).get('paid') ? 'payments' : 'overview');
  const [holds, setHolds] = useState(false);
  const walletAddr = publicKey?.toBase58() ?? "";
  const [receipt, setReceipt] = useState<{ idx: number; confirmed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [note, setNote] = useState("");
  const [applyIdx, setApplyIdx] = useState<number | null>(null);
  const [applyForm, setApplyForm] = useState({ name: "", link: "", availability: "" });
  const [applyFiles, setApplyFiles] = useState<{ name: string; url: string; kind: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [applyErr, setApplyErr] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState<any[] | null>(null);
  const [holdMsg, setHoldMsg] = useState<"holds" | "none" | null>(null);
  const [profileHref, setProfileHref] = useState<string | null>(null);
  const [mcap, setMcap] = useState<number | null>(null);
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const unlockRef = useRef<HTMLHeadingElement>(null);
  const rolesRef = useRef<HTMLElement>(null);
  const roleTarget = openRoleTarget(location.search, location.hash, r?.answers?.roles?.length || 0);
  const rolesVisible = isOwner || hasOpenRoles(r?.answers);

  useEffect(() => {
    if (!r || !rolesVisible || !roleTarget.requested) return;
    setTab('people');
    setWorkspaceTab('people');
  }, [r, rolesVisible, roleTarget.requested]);

  useEffect(() => {
    if (tab !== 'people' || !roleTarget.requested || !rolesVisible) return;
    const frame = requestAnimationFrame(() => {
      const target = roleTarget.index === null ? rolesRef.current : document.getElementById(`open-role-${roleTarget.index}`);
      target?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [tab, r, rolesVisible, roleTarget.requested, roleTarget.index]);

  useEffect(() => {
    (supabase.from as any)("releases")
      .select("id,title,creator_name,answers,budget_cents,artist_pct,fee_pct,cause_pct,cause_name,milestones,coin_mint,coin_ticker,coin_name,coin_image,cover_url,user_id,published_at,status,owner_note")
      .eq("slug", slug).eq("status", "published").maybeSingle()
      .then(async ({ data }: any) => {
        setR(data ?? null);
        if (!data) return;
        document.title = `${data.title} | Rhozeland`;
        setStatuses((data.milestones || []).map((_: any, i: number) => (i === 0 ? "Funded" : "Upcoming")));
        const { data: u } = await supabase.auth.getUser();
        if (u.user) setSignedIn(true);
        if (u.user && data.user_id === u.user.id) setIsOwner(true);
        const nm = (data.creator_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const from = `?from=${encodeURIComponent(slug)}`;
        let href: string | null = null;
        if (data.user_id) {
          const q = (supabase.from as any)("creator_directory").select("slug").eq("is_public", true).eq("approved", true);
          const { data: cd } = data.user_id ? await q.eq("user_id", data.user_id).limit(1).maybeSingle() : { data: null };
          if (cd?.slug) href = `/creator/${cd.slug}${from}`;
        }
        setProfileHref(href);
      }, () => setR(null));
  }, [slug]);

  // Live market cap for the attached coin (text only, via our coin-lookup function).
  useEffect(() => {
    setMcap(null); setPriceUsd(null); setChange24h(null);
    if (!r?.coin_mint) return;
    let alive = true;
    const load = () => supabase.functions.invoke("pumpfun-coin", { body: { mint: r.coin_mint } })
      .then(({ data }: any) => {
        if (!alive) return;
        setMcap(typeof data?.mcap === "number" && Number.isFinite(data.mcap) ? data.mcap : null);
        setPriceUsd(typeof data?.priceUsd === "number" && Number.isFinite(data.priceUsd) && data.priceUsd >= 0 ? data.priceUsd : null);
        setChange24h(typeof data?.change24h === "number" && Number.isFinite(data.change24h) ? data.change24h : null);
      })
      .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [r?.coin_mint]);

  useEffect(() => {
    if (!r?.answers?.roles) return;
    const a = new URLSearchParams(location.search).get("apply");
    if (a !== null && r.answers.roles[Number(a)]) openApply(Number(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);

  const openApply = (idx: number) => { setApplyErr(""); setApplyDone(false); setApplyForm({ name: "", link: "", availability: "" }); setApplyFiles([]); setApplyIdx(idx); };

  const addApplyFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    if (applyFiles.length + list.length > 6) return setApplyErr("You can attach up to 6 files.");
    setUploading(true); setApplyErr("");
    for (const f of Array.from(list)) {
      if (f.size > 50 * 1024 * 1024) { setApplyErr(`"${f.name}" is over 50 MB.`); continue; }
      const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const path = `applications/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, f, { contentType: f.type });
      if (error) { setApplyErr(`"${f.name}" could not be uploaded. Please try again.`); continue; }
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const kind = f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : f.type.startsWith("audio/") ? "audio" : "file";
      setApplyFiles((x) => [...x, { name: f.name, url, kind }]);
    }
    setUploading(false);
  };

  const submitApply = async () => {
    const name = applyForm.name.trim(), raw = applyForm.link.trim(), link = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw, availability = applyForm.availability.trim();
    if (!name || name.length > 100) return setApplyErr("Please add your name.");
    if (link && (!/^https?:\/\/[^\s.]+\.\S+$/i.test(link) || link.length > 500)) return setApplyErr("That link doesn't look right. Check it or leave it blank.");
    if (!availability || availability.length > 2000) return setApplyErr("Please add a short description or inquiry.");
    setApplyBusy(true); setApplyErr("");
    const { error } = await (supabase.rpc as any)("release_apply", { p_slug: slug, p_role_index: applyIdx, p_name: name, p_link: link, p_availability: availability, p_files: applyFiles });
    setApplyBusy(false);
    if (error) return setApplyErr("Your application could not be sent. Please try again.");
    setApplyDone(true);
    window.dispatchEvent(new Event('rhoze:rewards'));
  };

  const [confirmDel, setConfirmDel] = useState(false);
  const archive = async () => {
    const { error } = await (supabase.rpc as any)("release_set_archived", { p_id: r.id, p_archived: true });
    if (error) return setNote("Could not archive. Please try again.");
    location.href = "/me";
  };
  const del = async () => {
    if (r.cover_url) { const m = String(r.cover_url).match(/\/avatars\/(covers\/.+)$/); if (m) await supabase.storage.from("avatars").remove([m[1]]); }
    const { error } = await (supabase.rpc as any)("release_delete", { p_id: r.id });
    if (error) { setConfirmDel(false); return setNote("Could not delete. Please try again."); }
    location.href = "/me";
  };

  const loadApplicants = async () => {
    const token = localStorage.getItem("rz_release_token");
    setApplicants([]); setShowApplicants(true);
    const { data } = await (supabase.rpc as any)("release_list_applications", { p_token: token, p_id: r.id });
    setApplicants(data || []);
  };

  const markHired = async (id: string, status: "hired" | "applied") => {
    const token = localStorage.getItem("rz_release_token");
    const { error } = await (supabase.rpc as any)("release_set_application_status", { p_token: token, p_app_id: id, p_status: status });
    if (!error) setApplicants((list) => list?.map((a) => (a.id === id ? { ...a, status } : a)) ?? null);
  };

  const pumpUrl = r?.coin_mint ? `https://pump.fun/coin/${r.coin_mint}` : "";
  const ticker = r?.coin_ticker ? String(r.coin_ticker).replace(/^\$/, "") : "";
  const fmtMcap = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M mcap` : v >= 1_000 ? `$${Math.round(v).toLocaleString("en-US")} mcap` : `$${v.toFixed(0)} mcap`;
  const budget = Number(r?.budget_cents || 0);
  const projectUrl = `${location.origin}/release/${encodeURIComponent(slug)}`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(projectUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setNote("Could not copy the link. Please copy it from the address bar."); }
  };

  const startDeliver = () => {
    const idx = statuses.indexOf("Funded");
    if (idx < 0) { setNote("There is no funded milestone to deliver right now."); return; }
    setNote("");
    setReceipt({ idx, confirmed: false });
    setTimeout(() => {
      setReceipt({ idx, confirmed: true });
      setStatuses((s) => s.map((v, i) => (i === idx ? "Delivered" : i === idx + 1 ? "Funded" : v)));
    }, 2000);
  };

  useEffect(() => {
    if (!walletAddr || !r?.coin_mint) { setHolds(false); setBalState("idle"); setHoldMsg(null); return; }
    let off = false;
    setBalState("loading");
    fetchTokenBalance(walletAddr, r.coin_mint)
      .then((b) => {
        if (off) return;
        const has = b > 0;
        setHolds(has);
        setBalState("ok");
        const key = `rz_hold_seen:${walletAddr}:${r.coin_mint}`;
        if (has) {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            setHoldMsg("holds");
            setTimeout(() => unlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
          } else setHoldMsg(null);
        } else setHoldMsg("none");
      })
      .catch(() => { if (!off) { setHolds(false); setBalState("error"); } });
    return () => { off = true; };
  }, [walletAddr, r?.coin_mint, balTry]);

  useEffect(() => { if (connected) setConnErr(false); }, [connected]);

  const openConnect = () => {
    setConnErr(false);
    try { setVisible(true); } catch { setConnErr(true); }
  };
  const shortAddr = walletAddr ? `${walletAddr.slice(0, 4)}…${walletAddr.slice(-4)}` : "";

  const pill = (s: Status) => (
    <span className={`rz-status rz-status-${s.toLowerCase()}`}>{s}</span>
  );
  const pubs = { ...DEFAULT_PUBLIC_SECTIONS, ...(r?.answers?.public_sections || {}) };
  const merged = !!(r && isOwner && new URLSearchParams(location.search).get("projectView") !== "1");
  const show = (k: typeof tab) => tab !== 'exclusive' && ((merged && workspaceTab === 'publicPage') || tab === 'board' || tab === k);
  const publicVisible = !merged || ['publicPage', 'people', 'exclusive'].includes(workspaceTab);
  const openExclusive = () => {
    setTab('exclusive');
    setWorkspaceTab('exclusive');
    const url = new URL(location.href);
    url.searchParams.set('tab', 'exclusive'); url.hash = 'exclusive';
    history.replaceState(null, '', url);
    requestAnimationFrame(() => document.getElementById('exclusive')?.scrollIntoView({ block: 'start' }));
  };
  const closeProject = () => {
    if (window.self !== window.top && new URLSearchParams(location.search).get("projectView") === "1") {
      window.parent.postMessage("rhoze:close-project", location.origin);
    } else if (document.referrer.startsWith(location.origin) && history.length > 1) history.back();
    else location.href = "/discover";
  };

  return (
    <Shell className={`rz-release-view${new URLSearchParams(location.search).get("projectView") === "1" ? " rz-release-embedded" : ""}`}>
      <Button variant="ghost" size="icon" className="rz-release-close" aria-label="Close project" title="Close project" onClick={closeProject}><X size={20} /></Button>
      {r && isOwner && (
        <div className="rz-owner">
          <span>You own this page</span>
          <div>
            <a className="rz-btn" href={`/workspace/${r.id}`}>Edit project</a>
            <a className="rz-btn" href="/me">My profile</a>
            <button className="rz-btn" onClick={archive}>Archive</button>
            <button className="rz-btn" onClick={() => setConfirmDel(true)}>Delete</button>
            {r.answers?.roles?.length > 0 && <button className="rz-btn" onClick={loadApplicants}>Applicants</button>}
            <a className="rz-btn" href={`/workspace/${r.id}`}>Workspace</a>
          </div>
        </div>
      )}
      {r && isOwner && new URLSearchParams(location.search).get("projectView") !== "1" && (
        <ProjectWorkspace r={r} activeTab={workspaceTab} onTabChange={(next) => { setWorkspaceTab(next); if (next === 'exclusive') setTab('exclusive'); else if (next === 'people') setTab('people'); else if (next === 'publicPage') setTab('overview'); }} extraTabs={[["publicPage", "Project page"], ...(rolesVisible && r.answers?.roles?.length ? [["people", "Open roles"]] as [string, string][] : []), ["exclusive", "Exclusive"]]} onSaved={(next) => setR({ ...r, ...next })} />
      )}
      {publicVisible && <>
      <div className={`rz-card rz-release-content${r ? " rz-ws-dark rz-release-dark" : ""}${merged ? " rz-release-merged" : ""}`}>
        {r === undefined && <><div className="rz-skel" /><div className="rz-skel" /><div className="rz-skel" /></>}
        {r === null && (
          <div className="rz-head"><h1>Project not found</h1><p>This page may be unpublished or the link is wrong.</p>
            <div className="rz-actions"><a className="rz-btn pri" href="/">Back to home</a></div></div>
        )}
        {r && (
          <>
            {!merged && <header className="rz-release-header">
            <div className="rz-head">
              <div className="rz-ws-eyebrow">Public project · {(r.milestones || []).length} {(r.milestones || []).length === 1 ? "phase" : "phases"}</div>
              <h1 className="rz-ws-title">{new URLSearchParams(location.search).get("projectView") === "1" ? <a href={`/release/${encodeURIComponent(slug)}`} target="_top" style={{ color: "inherit", textDecoration: "none" }}>{r.title}</a> : r.title}</h1>
              <p>by {profileHref ? <a href={profileHref} className="rz-bylink"><b>{r.creator_name}</b></a> : <b>{r.creator_name || "Rhozeland artist"}</b>}</p>
              {r.fingerprint && <details className="rz-note" style={{ marginTop: 6 }}><summary style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Fingerprint size={14} /> Fingerprinted{r.chain_signature ? " · on Solana" : ""}</summary><p style={{ margin: "6px 0 0", fontSize: 12 }}>SHA-256 of this project as published{r.fingerprinted_at ? ` on ${new Date(r.fingerprinted_at).toLocaleDateString()}` : ""}:<br /><code style={{ wordBreak: "break-all" }}>{r.fingerprint}</code><br />{r.chain_signature ? <a href={`https://solscan.io/tx/${r.chain_signature}`} target="_blank" rel="noopener noreferrer">View on-chain record</a> : "Solana stamp pending."}</p></details>}
            </div>
            <div className="rz-release-tools">
              <ProjectHeart releaseId={r.id} />
              <Button variant="outline" size="icon" className="rz-release-share" title="Share project" aria-label="Share project" onClick={() => setShareOpen(true)}><Share2 size={16} /></Button>
              <Button className="rz-btn pri" onClick={openExclusive}>Support</Button>
            </div>
            </header>}
            {(() => {
              if (merged) return null;
              const roleCount = Array.isArray(r.answers?.roles) ? r.answers.roles.length : 0;
              const list: [typeof tab, string][] = [["board", "All details"], ["overview", "Overview"]];
              if (isOwner || pubs.plan) list.push(["roadmap", "Roadmap"]);
              if (rolesVisible && roleCount > 0) list.push(["people", "Open roles"]);
              if (isOwner || pubs.money || r.coin_mint) list.push(["budget", "Budget"]);
               list.push(["exclusive", "Exclusive"]);
              return <nav className="rz-ws-tabs rz-rd-tabs" role="tablist" aria-label="Project sections">{list.map(([k, l]) => <Button variant="ghost" key={k} role="tab" type="button" className="rz-ws-tab" aria-selected={tab === k} onClick={() => { setTab(k); const url = new URL(location.href); url.searchParams.set('tab', k); url.hash = k === 'exclusive' ? 'exclusive' : ''; history.replaceState(null, '', url); }}>{l}</Button>)}</nav>;
            })()}
            <div className="rz-board-layout rz-rd-layout"><div className="rz-rd-main"><PublicProjectCanvas>
            {tab === 'exclusive' && <section id="exclusive"><ExclusiveFeed slug={slug} project={r} owner={isOwner} /></section>}
            {r.coin_mint && (show("overview") || show("budget")) && <ReleasePrice key={r.coin_mint} mint={r.coin_mint} ticker={ticker} price={priceUsd} change={change24h} />}
            {show("overview") && <>
            <ProjectRewards releaseId={r.id} />
            <ProjectMetricsBadges slug={slug} milestones={r.milestones} openRoles={Array.isArray(r.answers?.roles) ? r.answers.roles.reduce((a: number, x: any) => a + (Number(x.count) || 1), 0) : 0} mcap={mcap} />
            {parseMediaLinks([...(r.answers?.media_links || []), r.answers?.source_url].filter(Boolean)).length ? (
              <ProjectMedia links={[...(r.answers?.media_links || []), r.answers?.source_url].filter(Boolean)} cover={r.cover_url || r.coin_image} title={r.title} />
            ) : (
            <div className="rz-cover">
              {r.cover_url || r.coin_image ? <img src={r.cover_url || r.coin_image} alt={`${r.title} cover art`} /> : <span>{r.title}</span>}
            </div>)}
            {(isOwner || pubs.overview) && <section className="rz-release-about">
              <h2 className="rz-h2">About the project</h2>
              {r.answers?.description?.trim() ? <p>{r.answers.description.trim()}</p> : r.answers?.making ? <p>{r.answers.making.trim()}</p> : <p>{r.title} by {r.creator_name || "Rhozeland artist"}.</p>}
              {r.answers?.audience && <p className="rz-release-audience">{r.answers.audience}</p>}
            </section>}
            <PublicTeasers slug={slug} title={r.title} locked={!!r.coin_mint} />
            {(isOwner || pubs.overview) && <ProjectStory story={r.answers || {}} />}
            </>}
            {(show("overview") || show("budget")) && <>
            <h2 className="rz-h2">Project release</h2>

            <div className="rz-release-coin">
              {ticker && pumpUrl ? (
                <a className="rz-chip" href={pumpUrl} target="_blank" rel="noopener noreferrer">
                  {r.coin_image && <img src={r.coin_image} alt="" />}<b>${ticker}</b>{mcap !== null ? <small>{fmtMcap(mcap)}</small> : <small>On Pump.fun</small>}
                </a>
              ) : <span className="rz-chip"><small>No coin attached yet</small></span>}
            </div>

             {(isOwner || pubs.money) && <p className="rz-note">Planning budget: {r.answers?.need_quote ? "estimate requested" : budget ? money(budget) : "not set yet"} · payment status is tracked in the private workspace.</p>}

            <div className="rz-actions" style={{ marginTop: "1rem", marginBottom: "1.4rem" }}>
              <Button className="rz-btn pri" onClick={openExclusive}>Support this project</Button>
              {!walletAddr && <button className="rz-btn" onClick={openConnect} disabled={connecting}>{connecting ? "Connecting…" : "Connect wallet"}</button>}
              <button className="rz-textlink" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button>
              <button className="rz-textlink" onClick={() => setShareOpen(true)}>Share</button>
            </div>
            {note && <p className="rz-note" style={{ marginTop: "-.8rem", marginBottom: "1rem" }}>{note}</p>}

            </>}
            {show("budget") && <>
            {(isOwner || pubs.money) && <>
            <h2 className="rz-h2">Project breakdown</h2>
            <div className="rz-split" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", fontWeight: 600 }}><span>Budget</span><span>{r.answers?.need_quote ? "Estimate requested" : budget ? money(budget) : "Not set yet"}</span></div>
              <div className="rz-bar">
                <i className="rz-c-a" style={{ width: `${r.artist_pct}%` }} /><i className="rz-c-f" style={{ width: `${r.fee_pct}%` }} /><i className="rz-c-c" style={{ width: `${r.cause_pct}%` }} />
              </div>
              {[["rz-c-a", "Artist", r.artist_pct], ["rz-c-f", "Rhozeland fee (includes coin launch)", r.fee_pct], ["rz-c-c", r.cause_name ? `Cause: ${r.cause_name}` : "Cause", r.cause_pct]].map(([c, l, p]) => (
                <div className="rz-split-row" key={l as string}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{Number(p)}%</span><span className="rz-amt">{budget ? money(budget * Number(p) / 100) : "—"}</span></div>
              ))}
              <div className="rz-cause">
                <span>Rewards go to {r.cause_name || "a cause the artist will name soon"}</span>
                <code>{CAUSE_WALLET}</code>
              </div>
            </div>

            </>}
            {r.coin_mint && <p className="rz-note break-all">Solana contract: <code>{r.coin_mint}</code> <Button variant="ghost" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(r.coin_mint); setNote("Contract address copied."); } catch { setNote("Could not copy the address."); } }}>Copy address</Button></p>}

            </>}
            {show("roadmap") && (isOwner || pubs.plan) && <>
            <h2 className="rz-h2">Roadmap &amp; deliverables</h2>
            <div className="rz-inv">
              <div className="rz-inv-h" style={{ gridTemplateColumns: "1.6rem 1fr 1.4fr 7rem" }}><span>#</span><span>Milestone</span><span>Deliverable</span><span style={{ textAlign: "right" }}>Amount</span></div>
              {(r.milestones || []).map((m: any, i: number) => (
                <div key={i} className="rz-row" style={{ gridTemplateColumns: "1.6rem 1fr auto", fontSize: ".78rem" }}>
                  <span className="rz-num" style={{ paddingTop: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div><b>{m.title}</b> {statuses[i] && pill(statuses[i])}<div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{m.deliverable}</div></div>
                  <span className="rz-amt">{money(m.amount_cents)}</span>
                </div>
              ))}
            </div>

            </>}

            {show("people") && rolesVisible && Array.isArray(r.answers?.roles) && r.answers.roles.length > 0 && (
              <section id="open-roles" ref={rolesRef} aria-label="Open roles">
                <h2 className="rz-h2">We're hiring</h2>
                <div className="rz-inv">
                  <div className="rz-inv-h" style={{ gridTemplateColumns: "1fr 5rem 6rem" }}><span>Role</span><span>Spots</span><span style={{ textAlign: "right" }}>Rate</span></div>
                  {r.answers.roles.map((role: any, i: number) => (
                    <div key={i} id={`open-role-${i}`} className={`rz-row${roleTarget.index === i ? ' rz-role-target' : ''}`} style={{ gridTemplateColumns: "1fr auto", fontSize: ".78rem", alignItems: "center" }}>
                      <div><b>{role.name}</b><div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{role.count} {Number(role.count) === 1 ? "spot" : "spots"}{role.rate ? ` · ${role.rate}` : ""}</div></div>
                      <Button variant="outline" size="sm" onClick={() => openApply(i)}>Apply</Button>
                      <div className="rz-opening-details"><RoleDetails role={role}/></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {show("unlocks") && <>
            {holdMsg === "holds" && (
              <p className="rz-note" style={{ marginTop: "1.2rem", padding: ".8rem 1rem", border: "1px solid hsl(var(--line))", borderRadius: 12 }}>
                You hold {ticker ? "$" + ticker : "the coin"} — your unlocks are below
              </p>
            )}
            {holdMsg === "none" && (
              <p className="rz-note" style={{ marginTop: "1.2rem" }}>
                Connected, but you don't hold {ticker ? "$" + ticker : "the coin"} yet
              </p>
            )}
            <h2 className="rz-h2" ref={unlockRef}>Unlocks</h2>
            <div className="rz-inv">
              <div className="rz-unlock">
                <span className="rz-ico-btn" aria-label="Play">▶</span>
                <div><b>Behind the scenes update</b><small>Unlocked for everyone</small></div>
              </div>
              <Button variant="ghost" className={`rz-unlock ${holds ? "ok" : ""}`} onClick={openExclusive}>
                <span className="rz-ico-btn" aria-hidden>{holds ? "→" : "🔒"}</span>
                <div><b>Holder feed</b><small>{holds ? "Unlocked with your wallet. Open the feed" : `Stems, files and updates for ${ticker ? "$" + ticker : "coin"} holders`}</small></div>
              </Button>
            </div>
            {connErr && (
              <p className="rz-note" style={{ marginTop: ".8rem" }}>
                We couldn't connect your wallet. <button className="rz-textlink" onClick={openConnect}>Try again</button>
              </p>
            )}
            {r.coin_mint && balState === "loading" && <p className="rz-note" style={{ marginTop: ".8rem" }}>Checking your wallet…</p>}
            {r.coin_mint && balState === "error" && (
              <p className="rz-note" style={{ marginTop: ".8rem" }}>
                We couldn't check your wallet right now. <button className="rz-textlink" onClick={() => setBalTry((n) => n + 1)}>Retry</button>
              </p>
            )}

            <p className="rz-note" style={{ marginTop: "1.6rem" }}>Tokens trade on Pump.fun. Rhoze does not operate the sale.</p>
            </>}
            {show("overview") && <ProjectDiscussion releaseId={r.id} />}
            </PublicProjectCanvas></div>
            {!merged && <aside className="rz-board-side">
              {(isOwner || pubs.plan) && (r.milestones || []).length > 0 && <button type="button" className="rz-side-card rz-rd-side" onClick={() => setTab("roadmap")}><h4>Roadmap</h4>
                <div className="rz-side-big">{statuses.filter((x) => x === "Delivered").length}/{(r.milestones || []).length}</div>
                {(r.milestones || []).slice(0, 4).map((m: any, i: number) => <div className="rz-side-row" key={i}><span>{m.title}</span><small>{statuses[i] || "Upcoming"}</small></div>)}
              </button>}
              <div className="rz-side-card"><h4>Release as a coin</h4>
                <p>{ticker ? <>Paired with <b>${ticker}</b>{mcap !== null ? ` · ${fmtMcap(mcap)}` : ""}.</> : "No coin attached yet."}</p>
                <Button className="rz-btn pri" onClick={openExclusive}>Support</Button>
                {pumpUrl && <a className="rz-btn" href={pumpUrl} target="_blank" rel="noopener noreferrer">Pump.fun</a>}
              </div>
              {rolesVisible && Array.isArray(r.answers?.roles) && r.answers.roles.length > 0 && <button type="button" className="rz-side-card rz-rd-side" onClick={() => setTab("people")}><h4>Open roles</h4>
                {r.answers.roles.slice(0, 4).map((role: any, i: number) => <div className="rz-side-row" key={i}><span>{role.name}</span><small>{role.rate || `${role.count || 1} spot`}</small></div>)}
              </button>}
            </aside>}
            </div>
          </>
        )}
      </div>
      </>}

      {r && <RelatedProjects href={`/release/${slug}`} artist={r.creator_name} categories={r.answers?.category} />}

      {applyIdx !== null && r && (
        <div className="rz-modal" onClick={() => !applyBusy && setApplyIdx(null)}>
          <div className="rz-card rz-apply-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1 style={{ fontSize: "1.1rem" }}>Apply: {r.answers.roles[applyIdx]?.name}</h1>
              <p>{r.title}{r.answers.roles[applyIdx]?.rate ? ` · ${r.answers.roles[applyIdx].rate}` : ""}</p>
            </div>
            <RoleDetails role={r.answers.roles[applyIdx] ?? {}} />

            {applyDone ? (
              <>
                <p style={{ fontSize: ".85rem" }}>{signedIn ? "Thanks, your application was sent. A copy is in your Messages and the project owner's inbox." : "Thanks, your application was sent. Sign in next time to get a copy in your Messages and chat with the owner."}</p>
                <div className="rz-actions" style={{ marginTop: "1.2rem" }}>{signedIn && <a className="rz-btn" href="/messages">Open Messages</a>}<button className="rz-btn pri" onClick={() => setApplyIdx(null)}>Done</button></div>
              </>
            ) : (
              <>
                <div className="rz-field"><label>Your name</label><input className="rz-in" maxLength={100} value={applyForm.name} onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })} /></div>
                <div className="rz-field" style={{ marginTop: ".7rem" }}><label>Portfolio or creator profile link <span style={{ color: "hsl(var(--mut))", fontWeight: 400 }}>(optional)</span></label><input className="rz-in" maxLength={500} placeholder="yourportfolio.com" value={applyForm.link} onChange={(e) => setApplyForm({ ...applyForm, link: e.target.value })} /></div>
                <div className="rz-field" style={{ marginTop: ".7rem" }}><label>Description or inquiry</label><textarea className="rz-in" maxLength={2000} placeholder="Tell them about yourself, your experience, or ask a question" value={applyForm.availability} onChange={(e) => setApplyForm({ ...applyForm, availability: e.target.value })} /></div>
                <div className="rz-field" style={{ marginTop: ".7rem" }}><label>Attachments <span style={{ color: "hsl(var(--mut))", fontWeight: 400 }}>(optional — images, videos or files, up to 6)</span></label>
                  <input type="file" multiple accept="image/*,video/*,audio/*,.pdf,.zip,.doc,.docx" onChange={(e) => { addApplyFiles(e.target.files); e.target.value = ""; }} disabled={uploading} />
                  {uploading && <p className="rz-note" style={{ marginTop: ".3rem" }}>Uploading…</p>}
                  {applyFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: ".4rem", marginTop: ".4rem" }}>
                      {applyFiles.map((f, i) => (
                        <span key={i} className="rz-chipbtn" style={{ display: "inline-flex", alignItems: "center", gap: ".35rem" }}>
                          {f.kind === "image" ? "🖼" : f.kind === "video" ? "▶" : f.kind === "audio" ? "♪" : "📎"} {f.name.length > 24 ? f.name.slice(0, 22) + "…" : f.name}
                          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setApplyFiles((x) => x.filter((_, j) => j !== i))} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", padding: 0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {applyErr && <p className="rz-note" style={{ color: "hsl(var(--destructive, 0 70% 50%))", marginTop: ".6rem" }}>{applyErr}</p>}
                <div className="rz-actions" style={{ marginTop: "1.2rem" }}>
                  <button className="rz-btn" onClick={() => setApplyIdx(null)}>Cancel</button>
                  <button className="rz-btn pri" disabled={applyBusy} onClick={submitApply}>{applyBusy ? "Sending…" : "Submit"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {confirmDel && r && (
        <div className="rz-modal" onClick={() => setConfirmDel(false)}>
          <div className="rz-card" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: 0 }}><h1>Delete this project?</h1>
              <p>This can't be undone. The roadmap, roles, applicants, cover art and receipts will be removed.</p>
              <div className="rz-actions"><button className="rz-btn" onClick={() => setConfirmDel(false)}>Cancel</button><button className="rz-btn pri" onClick={del}>Delete forever</button></div></div>
          </div>
        </div>
      )}
      {showApplicants && r && (
        <div className="rz-modal" onClick={() => setShowApplicants(false)}>
          <div className="rz-card" style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1 style={{ fontSize: "1.1rem" }}>Applicants</h1>
              <p>{r.title}</p>
            </div>
            {applicants === null || applicants.length === 0 ? (
              <p style={{ fontSize: ".82rem", color: "hsl(var(--mut))" }}>{applicants === null ? "Loading…" : "No one has applied yet."}</p>
            ) : (
              (r.answers.roles as any[]).map((role, ri) => {
                const list = applicants.filter((a) => a.role_index === ri);
                if (!list.length) return null;
                return (
                  <div key={ri} style={{ marginBottom: "1rem" }}>
                    <h2 className="rz-h2" style={{ marginTop: 0 }}>{role.name} <span style={{ color: "hsl(var(--mut))", fontWeight: 400 }}>({list.length})</span></h2>
                    <div className="rz-inv">
                      {list.map((a) => (
                        <div key={a.id} className="rz-row" style={{ gridTemplateColumns: "1fr auto", fontSize: ".78rem", alignItems: "center" }}>
                          <div style={{ minWidth: 0 }}>
                            <b>{a.name}</b> {a.status === "hired" && <span className="rz-status rz-status-delivered">Hired</span>}
                            {a.link && <div><a className="rz-textlink" href={a.link} target="_blank" rel="noopener noreferrer nofollow" style={{ wordBreak: "break-all" }}>{a.link}</a></div>}
                            <div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{a.availability}</div>
                            {Array.isArray(a.files) && a.files.length > 0 && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem", marginTop: ".3rem" }}>
                                {a.files.map((f: any, fi: number) => (
                                  <a key={fi} className="rz-textlink" href={f.url} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: ".72rem" }}>
                                    {f.kind === "image" ? "🖼" : f.kind === "video" ? "▶" : f.kind === "audio" ? "♪" : "📎"} {f.name || `File ${fi + 1}`}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          {a.status === "hired"
                            ? <button className="rz-btn" style={{ padding: ".28rem .8rem", fontSize: ".68rem" }} onClick={() => markHired(a.id, "applied")}>Undo</button>
                            : <button className="rz-btn pri" style={{ padding: ".28rem .8rem", fontSize: ".68rem" }} onClick={() => markHired(a.id, "hired")}>Mark hired</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            <div className="rz-actions" style={{ marginTop: "1rem" }}><button className="rz-btn pri" onClick={() => setShowApplicants(false)}>Close</button></div>
          </div>
        </div>
      )}

      {receipt && r && (
        <div className="rz-modal" onClick={() => receipt.confirmed && setReceipt(null)}>
          <div className="rz-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1 style={{ fontSize: "1.1rem" }}>Split receipt</h1>
              <p>Milestone {String(receipt.idx + 1).padStart(2, "0")}: {r.milestones[receipt.idx]?.title}</p>
            </div>
            {(() => {
              const amt = Number(r.milestones[receipt.idx]?.amount_cents || 0);
              return [["rz-c-a", "Artist", r.artist_pct], ["rz-c-f", "Rhozeland", r.fee_pct], ["rz-c-c", "Cause", r.cause_pct]].map(([c, l, p]) => (
                <div className="rz-split-row" key={l as string}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{Number(p)}%</span><span className="rz-amt">{money(amt * Number(p) / 100)}</span></div>
              ));
            })()}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: ".9rem", fontSize: ".75rem" }}>
              <span className={`rz-status ${receipt.confirmed ? "rz-status-delivered" : "rz-status-upcoming"}`}>{receipt.confirmed ? "Confirmed" : "Pending"}</span>
              <a className="rz-textlink" href="https://solscan.io" target="_blank" rel="noopener noreferrer">View on Solscan</a>
            </div>
            <div className="rz-actions" style={{ marginTop: "1.2rem" }}>
              <button className="rz-btn pri" disabled={!receipt.confirmed} onClick={() => setReceipt(null)}>Done</button>
              <button className="rz-btn" onClick={() => setShareOpen(true)}>Share</button>
            </div>
          </div>
        </div>
      )}
      {shareOpen && r && (() => {
        const shareUrl = projectUrl;
        const shareText = `Support ${r.title} on Rhoze`;
        const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        const doCopy = async () => {
          try { await navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); } catch { /* ignore */ }
        };
        return (
          <div className="rz-modal" onClick={() => setShareOpen(false)}>
            <div className="rz-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <div className="rz-head" style={{ marginBottom: "1rem" }}>
                <h1 style={{ fontSize: "1.1rem" }}>Share this project</h1>
                <p>Post it anywhere, or copy the link.</p>
              </div>
              <div className="rz-card" style={{ padding: 0, overflow: "hidden", marginBottom: "1rem" }}>
                {r.cover_url
                  ? <img src={r.cover_url} alt={r.title} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                  : <div className="rz-cover" style={{ aspectRatio: "16/9" }} />}
                <div style={{ padding: ".9rem 1rem" }}>
                  <b style={{ display: "block", fontSize: ".95rem" }}>{r.title}</b>
                  <span style={{ fontSize: ".8rem", opacity: .7 }}>{shareText}</span>
                </div>
              </div>
              <div className="rz-actions">
                <button className="rz-btn pri" onClick={doCopy}>{shareCopied ? "Link copied" : "Copy link"}</button>
                <a className="rz-btn" href={xUrl} target="_blank" rel="noopener noreferrer">Share to X</a>
                <button className="rz-textlink" onClick={() => setShareOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </Shell>
  );
}
