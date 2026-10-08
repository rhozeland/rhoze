import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, money } from "./shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { SolanaWalletProvider, fetchTokenBalance } from "./SolanaWallet";

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
  const [holds, setHolds] = useState(false);
  const walletAddr = publicKey?.toBase58() ?? "";
  const [receipt, setReceipt] = useState<{ idx: number; confirmed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [note, setNote] = useState("");
  const [applyIdx, setApplyIdx] = useState<number | null>(null);
  const [applyForm, setApplyForm] = useState({ name: "", link: "", availability: "" });
  const [applyErr, setApplyErr] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyDone, setApplyDone] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);
  const [applicants, setApplicants] = useState<any[] | null>(null);
  const [holdMsg, setHoldMsg] = useState<"holds" | "none" | null>(null);
  const [profileHref, setProfileHref] = useState<string | null>(null);
  const [mcap, setMcap] = useState<number | null>(null);
  const unlockRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    (supabase.from as any)("releases")
      .select("id,title,creator_name,answers,budget_cents,artist_pct,fee_pct,cause_pct,cause_name,milestones,coin_mint,coin_ticker,coin_name,coin_image,cover_url,user_id,published_at")
      .eq("slug", slug).eq("status", "published").maybeSingle()
      .then(async ({ data }: any) => {
        setR(data ?? null);
        if (!data) return;
        document.title = `${data.title} | Rhozeland`;
        setStatuses((data.milestones || []).map((_: any, i: number) => (i === 0 ? "Funded" : "Upcoming")));
        const { data: u } = await supabase.auth.getUser();
        if (u.user && data.user_id === u.user.id) setIsOwner(true);
        const nm = (data.creator_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        const from = `?from=${encodeURIComponent(slug)}`;
        let href = nm ? `/brand/${nm}${from}` : null;
        if (data.answers?.project_type !== "brand") {
          const q = (supabase.from as any)("creator_directory").select("slug");
          const { data: cd } = data.user_id ? await q.eq("user_id", data.user_id).limit(1).maybeSingle() : { data: null };
          if (cd?.slug) href = `/creator/${cd.slug}${from}`;
        }
        setProfileHref(href);
      }, () => setR(null));
  }, [slug]);

  // Live market cap for the attached coin (text only, via our coin-lookup function).
  useEffect(() => {
    if (!r?.coin_mint) { setMcap(null); return; }
    let alive = true;
    const load = () => supabase.functions.invoke("pumpfun-coin", { body: { mint: r.coin_mint } })
      .then(({ data }: any) => { if (alive && typeof data?.mcap === "number") setMcap(data.mcap); })
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

  const openApply = (idx: number) => { setApplyErr(""); setApplyDone(false); setApplyForm({ name: "", link: "", availability: "" }); setApplyIdx(idx); };

  const submitApply = async () => {
    const name = applyForm.name.trim(), link = applyForm.link.trim(), availability = applyForm.availability.trim();
    if (!name || name.length > 100) return setApplyErr("Please add your name.");
    if (!/^https?:\/\/\S+$/i.test(link) || link.length > 500) return setApplyErr("Please add a full link that starts with https://.");
    if (!availability || availability.length > 500) return setApplyErr("Please tell us when you are available.");
    setApplyBusy(true); setApplyErr("");
    const { error } = await (supabase.rpc as any)("release_apply", { p_slug: slug, p_role_index: applyIdx, p_name: name, p_link: link, p_availability: availability });
    setApplyBusy(false);
    if (error) return setApplyErr("Your application could not be sent. Please try again.");
    setApplyDone(true);
  };

  const [confirmDel, setConfirmDel] = useState(false);
  const archive = async () => {
    const { error } = await (supabase.rpc as any)("release_set_archived", { p_id: r.id, p_archived: true });
    if (error) return setNote("Could not archive. Please try again.");
    location.href = "/my-projects?filter=archived";
  };
  const del = async () => {
    if (r.cover_url) { const m = String(r.cover_url).match(/\/avatars\/(covers\/.+)$/); if (m) await supabase.storage.from("avatars").remove([m[1]]); }
    const { error } = await (supabase.rpc as any)("release_delete", { p_id: r.id });
    if (error) { setConfirmDel(false); return setNote("Could not delete. Please try again."); }
    location.href = "/my-projects";
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
  const funded = Math.round(budget * 0.35);

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); }
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

  return (
    <Shell right={walletAddr ? <span className="rz-wallet-chip"><i />{shortAddr} <small>Solana</small></span> : <a className="rz-link" href="/create.html?new=1">Create a project</a>}>
      {r && isOwner && (
        <div className="rz-owner">
          <span>You own this page</span>
          <div>
            <a className="rz-btn" href={`/create.html?draft=${r.id}`}>Edit project</a>
            <a className="rz-btn" href="/my-projects">My projects</a>
            <button className="rz-btn" onClick={archive}>Archive</button>
            <button className="rz-btn" onClick={() => setConfirmDel(true)}>Delete</button>
            {r.answers?.project_type === "brand" && <button className="rz-btn" onClick={loadApplicants}>Applicants</button>}
            <button className="rz-btn pri" onClick={startDeliver}>Mark milestone delivered</button>
          </div>
        </div>
      )}
      <div className="rz-card">
        {r === undefined && <><div className="rz-skel" /><div className="rz-skel" /><div className="rz-skel" /></>}
        {r === null && (
          <div className="rz-head"><h1>Project not found</h1><p>This page may be unpublished or the link is wrong.</p>
            <div className="rz-actions"><a className="rz-btn pri" href="/">Back to home</a></div></div>
        )}
        {r && (
          <>
            <div className="rz-cover">
              {r.cover_url || r.coin_image ? <img src={r.cover_url || r.coin_image} alt={`${r.title} cover art`} /> : <span>{r.title}</span>}
            </div>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1 style={{ fontSize: "1.6rem" }}>{r.title}</h1>
              <p>by {profileHref ? <a href={profileHref} className="rz-bylink"><b>{r.creator_name}</b></a> : <b>{r.creator_name || "Rhozeland artist"}</b>}</p>
              {r.answers?.making && <p style={{ maxWidth: 480 }}>{firstSentence(r.answers.making)}</p>}
            </div>

            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              {ticker && pumpUrl ? (
                <a className="rz-chip" href={pumpUrl} target="_blank" rel="noopener noreferrer">
                  {r.coin_image && <img src={r.coin_image} alt="" />}<b>${ticker}</b><small>Attached on Pump.fun</small>
                </a>
              ) : <span className="rz-chip"><small>No coin attached yet</small></span>}
            </div>

            <div className="rz-fund">
              <div><span>Funded <b>{money(funded)}</b> of {money(budget)}</span><span>{budget ? Math.round((funded / budget) * 100) : 0}%</span></div>
              <div className="rz-fund-bar"><i style={{ width: `${budget ? (funded / budget) * 100 : 0}%` }} /></div>
            </div>

            <div className="rz-actions" style={{ marginTop: "1rem", marginBottom: "1.4rem" }}>
              <a className="rz-btn pri" href={`/release/${encodeURIComponent(slug)}/exclusive`}>Support this project</a>
              {!walletAddr && <button className="rz-btn" onClick={openConnect} disabled={connecting}>{connecting ? "Connecting…" : "Connect wallet"}</button>}
              <button className="rz-textlink" onClick={copyLink}>{copied ? "Link copied" : "Copy link"}</button>
              <button className="rz-textlink" onClick={() => setShareOpen(true)}>Share</button>
            </div>
            {note && <p className="rz-note" style={{ marginTop: "-.8rem", marginBottom: "1rem" }}>{note}</p>}

            <div className="rz-split" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".75rem", fontWeight: 600 }}><span>Budget</span><span>{money(budget)}</span></div>
              <div className="rz-bar">
                <i className="rz-c-a" style={{ width: `${r.artist_pct}%` }} /><i className="rz-c-f" style={{ width: `${r.fee_pct}%` }} /><i className="rz-c-c" style={{ width: `${r.cause_pct}%` }} />
              </div>
              {[["rz-c-a", "Artist", r.artist_pct], ["rz-c-f", "Rhozeland fee", r.fee_pct], ["rz-c-c", r.cause_name ? `Cause: ${r.cause_name}` : "Cause", r.cause_pct]].map(([c, l, p]) => (
                <div className="rz-split-row" key={l as string}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{Number(p)}%</span><span className="rz-amt">{money(budget * Number(p) / 100)}</span></div>
              ))}
              <div className="rz-cause">
                <span>Rewards go to {r.cause_name || "a cause the artist will name soon"}</span>
                <code>{CAUSE_WALLET}</code>
              </div>
            </div>

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

            {r.answers?.project_type === "brand" && Array.isArray(r.answers?.roles) && r.answers.roles.length > 0 && (
              <>
                <h2 className="rz-h2">We're hiring</h2>
                <div className="rz-inv">
                  <div className="rz-inv-h" style={{ gridTemplateColumns: "1fr 5rem 6rem" }}><span>Role</span><span>Spots</span><span style={{ textAlign: "right" }}>Rate</span></div>
                  {r.answers.roles.map((role: any, i: number) => (
                    <div key={i} className="rz-row" style={{ gridTemplateColumns: "1fr auto", fontSize: ".78rem", alignItems: "center" }}>
                      <div><b>{role.name}</b><div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{role.count} {Number(role.count) === 1 ? "spot" : "spots"}{role.rate ? ` · ${role.rate}` : ""}</div></div>
                      <button className="rz-btn" style={{ padding: ".28rem .8rem", fontSize: ".68rem" }} onClick={() => openApply(i)}>Apply</button>
                    </div>
                  ))}
                </div>
              </>
            )}

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
              <a className={`rz-unlock ${holds ? "ok" : ""}`} href={`/release/${encodeURIComponent(slug)}/exclusive`} style={{ color: "inherit", textDecoration: "none" }}>
                <span className="rz-ico-btn" aria-hidden>{holds ? "→" : "🔒"}</span>
                <div><b>Holder feed</b><small>{holds ? "Unlocked with your wallet. Open the feed" : `Stems, files and updates for ${ticker ? "$" + ticker : "coin"} holders`}</small></div>
              </a>
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
          </>
        )}
      </div>

      {applyIdx !== null && r && (
        <div className="rz-modal" onClick={() => !applyBusy && setApplyIdx(null)}>
          <div className="rz-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="rz-head" style={{ marginBottom: "1rem" }}>
              <h1 style={{ fontSize: "1.1rem" }}>Apply: {r.answers.roles[applyIdx]?.name}</h1>
              <p>{r.title}{r.answers.roles[applyIdx]?.rate ? ` · ${r.answers.roles[applyIdx].rate}` : ""}</p>
            </div>
            {applyDone ? (
              <>
                <p style={{ fontSize: ".85rem" }}>Thanks, your application was sent. The project owner will review it.</p>
                <div className="rz-actions" style={{ marginTop: "1.2rem" }}><button className="rz-btn pri" onClick={() => setApplyIdx(null)}>Done</button></div>
              </>
            ) : (
              <>
                <div className="rz-field"><label>Your name</label><input className="rz-in" maxLength={100} value={applyForm.name} onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })} /></div>
                <div className="rz-field" style={{ marginTop: ".7rem" }}><label>Portfolio or Community profile link</label><input className="rz-in" maxLength={500} placeholder="https://" value={applyForm.link} onChange={(e) => setApplyForm({ ...applyForm, link: e.target.value })} /></div>
                <div className="rz-field" style={{ marginTop: ".7rem" }}><label>Availability</label><textarea className="rz-in" maxLength={500} placeholder="Weekends in October, or any weekday after 5pm" value={applyForm.availability} onChange={(e) => setApplyForm({ ...applyForm, availability: e.target.value })} /></div>
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
                            <div><a className="rz-textlink" href={a.link} target="_blank" rel="noopener noreferrer nofollow" style={{ wordBreak: "break-all" }}>{a.link}</a></div>
                            <div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{a.availability}</div>
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
        const shareUrl = window.location.href;
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
