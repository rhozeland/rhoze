import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, Milestone, money, uid } from "./shared";

const TOKEN_KEY = "rz_release_token";
const DRAFT_KEY = "rz_release_draft";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function getToken() {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) { t = uid() + uid(); localStorage.setItem(TOKEN_KEY, t); }
  return t;
}

type Coin = { mint: string; ticker: string; name: string; image: string | null } | null;

export default function CreateProject() {
  const token = useMemo(getToken, []);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [making, setMaking] = useState("");
  const [audience, setAudience] = useState("");
  const [budget, setBudget] = useState("");
  const [feePct, setFeePct] = useState(10);
  const [causePct, setCausePct] = useState(10);
  const [causeName, setCauseName] = useState("");
  const [rows, setRows] = useState<Milestone[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [mint, setMint] = useState("");
  const [ticker, setTicker] = useState("");
  const [meta, setMeta] = useState<{ mint: string; name: string; image: string | null } | null>(null);
  const [coinBusy, setCoinBusy] = useState(false);
  const [coinErr, setCoinErr] = useState("");
  const [wallet, setWallet] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);

  const budgetCents = Math.max(0, Math.round((parseFloat(budget.replace(/[^0-9.]/g, "")) || 0) * 100));
  const artistPct = Math.max(0, 100 - feePct - causePct);
  const mintOk = MINT_RE.test(mint.trim());
  const tick = ticker.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  const coin: Coin = mintOk && tick ? { mint: mint.trim(), ticker: tick, name: meta?.mint === mint.trim() ? meta.name : tick, image: meta?.mint === mint.trim() ? meta.image : null } : null;
  const rowsTotal = rows.reduce((s, r) => s + (r.amount_cents || 0), 0);

  // Load draft or booking prefill
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get("draft") || localStorage.getItem(DRAFT_KEY);
    let booking: any = {};
    try { booking = JSON.parse(sessionStorage.getItem("rz_booking") || localStorage.getItem("rz_booking") || "{}"); } catch { /* */ }
    const applyBooking = () => {
      if (booking.name) setName(booking.name);
      if (booking.email) setEmail(booking.email);
      if (booking.project) setTitle(booking.project);
      if (booking.description) setMaking(booking.description);
      if (booking.id) setBookingId(booking.id);
    };
    if (!id || params.get("new") === "1") { applyBooking(); return; }
    (async () => {
      const { data } = await (supabase.rpc as any)("release_get_draft", { p_token: token, p_id: id });
      const r = Array.isArray(data) ? data[0] : null;
      if (!r || r.status === "published") { localStorage.removeItem(DRAFT_KEY); applyBooking(); return; }
      setDraftId(r.id); setStep(r.current_step || 1);
      setName(r.creator_name || booking.name || ""); setEmail(r.creator_email || booking.email || "");
      setTitle(r.title || ""); setMaking(r.answers?.making || ""); setAudience(r.answers?.audience || "");
      setBudget(r.budget_cents ? String(r.budget_cents / 100) : "");
      setFeePct(Number(r.fee_pct)); setCausePct(Number(r.cause_pct)); setCauseName(r.cause_name || "");
      setRows((r.milestones || []).map((m: any) => ({ id: uid(), ...m })));
      if (r.coin_mint) { setMint(r.coin_mint); setTicker(r.coin_ticker || ""); setMeta({ mint: r.coin_mint, name: r.coin_name, image: r.coin_image }); }
      setWallet(r.payout_wallet || "");
    })();
  }, [token]);

  const payload = (s = step) => ({
    title: title.trim(), creator_name: name.trim(), creator_email: email.trim(), booking_id: bookingId,
    answers: { making: making.trim(), audience: audience.trim() },
    budget_cents: budgetCents, artist_pct: artistPct, fee_pct: feePct, cause_pct: causePct, cause_name: causeName.trim(),
    milestones: rows.map(({ title, deliverable, amount_cents }) => ({ title: title.trim(), deliverable: deliverable.trim(), amount_cents })),
    coin_mint: coin?.mint ?? "", coin_ticker: coin?.ticker ?? "", coin_name: coin?.name ?? "", coin_image: coin?.image ?? "",
    payout_wallet: wallet.trim(), current_step: s,
  });

  const save = async (s = step): Promise<string | null> => {
    setSaving(true); setErr("");
    const { data, error } = await (supabase.rpc as any)("release_save", { p_token: token, p_id: draftId, p_data: payload(s) });
    setSaving(false);
    if (error) { setErr("We couldn't save your draft. Check your connection and try again."); return null; }
    setDraftId(data); localStorage.setItem(DRAFT_KEY, data);
    const u = new URL(location.href); u.searchParams.set("draft", data); u.searchParams.delete("new"); history.replaceState(null, "", u);
    setSavedAt(new Date());
    return data as string;
  };

  const validate1 = () => {
    if (!name.trim()) return "Add your name.";
    if (!title.trim()) return "Give your project a name.";
    if (!making.trim()) return "Tell us what you're making.";
    if (budgetCents < 100) return "Enter a budget.";
    if (feePct + causePct > 100) return "Fee and cause can't exceed 100%.";
    return "";
  };

  const generate = async () => {
    setGenBusy(true); setErr("");
    const { data, error } = await supabase.functions.invoke("release-roadmap", {
      body: { title: title.trim(), answers: { making, audience }, budget_cents: budgetCents, artist_pct: artistPct },
    });
    setGenBusy(false);
    if (error || !data?.milestones) {
      let msg = "Couldn't generate a roadmap. You can add rows manually.";
      try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* */ }
      setErr(msg);
      if (!rows.length) setRows([{ id: uid(), title: "", deliverable: "", amount_cents: budgetCents }]);
      return;
    }
    setRows(data.milestones.map((m: any) => ({ id: uid(), ...m })));
  };

  const goStep2 = async () => {
    const v = validate1(); if (v) { setErr(v); return; }
    setStep(2); save(2);
    if (!rows.length) generate();
  };

  const validate2 = () => {
    if (!rows.length) return "Add at least one milestone.";
    if (rows.some((r) => !r.title.trim())) return "Every milestone needs a title.";
    return "";
  };

  const goStep3 = () => { const v = validate2(); if (v) { setErr(v); return; } setErr(""); setStep(3); save(3); };
  const goStep4 = () => {
    if (mint.trim() && !mintOk) { setErr("That mint address doesn't look right. Solana addresses are 32 to 44 letters and numbers."); return; }
    if (mint.trim() && !tick) { setErr("Add your coin's ticker, like $SUMMER."); return; }
    setErr(""); setStep(4); save(4);
  };

  // Coin lookup (debounced) — fills image/ticker when available
  const lookupRef = useRef(0);
  useEffect(() => {
    const m = mint.trim();
    setCoinErr("");
    if (!m) return;
    if (!MINT_RE.test(m)) { if (m.length >= 20) setCoinErr("That doesn't look like a Solana mint address. It should be 32 to 44 letters and numbers."); return; }
    if (meta?.mint === m) return;
    const n = ++lookupRef.current;
    setCoinBusy(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("pumpfun-coin", { body: { mint: m } });
        if (n !== lookupRef.current) return;
        if (data?.ticker) { setMeta({ mint: m, name: data.name, image: data.image }); setTicker((x) => x || data.ticker); }
      } catch { /* manual ticker still works */ }
      if (n === lookupRef.current) setCoinBusy(false);
    }, 400);
    return () => { clearTimeout(t); setCoinBusy(false); };
  }, [mint]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipCoin = () => { setMint(""); setTicker(""); setMeta(null); setCoinErr(""); setErr(""); setStep(4); save(4); };

  const publish = async () => {
    if (mint.trim() && !coin) { setErr("Fix the coin details or skip the coin step."); setStep(3); return; }
    setPublishing(true);
    const id = await save(4);
    if (!id) { setPublishing(false); return; }
    const { data, error } = await (supabase.rpc as any)("release_publish", { p_token: token, p_id: id });
    setPublishing(false);
    if (error) { setErr("We couldn't publish right now. Your draft is saved — please try again."); return; }
    localStorage.removeItem(DRAFT_KEY);
    location.href = `/release/${data}`;
  };

  const updateRow = (id: string, patch: Partial<Milestone>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const a = [...rs]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const steps = ["Details", "Roadmap", "Coin", "Publish"];
  const SplitMini = () => (
    <div className="rz-split" style={{ marginBottom: ".9rem" }}>
      <div className="rz-bar"><i className="rz-c-a" style={{ width: `${artistPct}%` }} /><i className="rz-c-f" style={{ width: `${feePct}%` }} /><i className="rz-c-c" style={{ width: `${causePct}%` }} /></div>
      {([["rz-c-a", "Artist", artistPct], ["rz-c-f", "Rhozeland fee", feePct], ["rz-c-c", causeName.trim() ? `Cause · ${causeName.trim()}` : "Cause", causePct]] as const).map(([c, l, p]) => (
        <div className="rz-split-row" key={c}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{p}%</span><span className="rz-amt">{money(budgetCents * p / 100)}</span></div>
      ))}
    </div>
  );
  const CoinChip = () => coin ? (
    <div className="rz-coin">
      {coin.image ? <img src={coin.image} alt={coin.ticker} /> : null}
      <div style={{ minWidth: 0 }}><b>${coin.ticker}</b>{coin.name && coin.name !== coin.ticker && <> <span className="rz-opt" style={{ fontSize: ".72rem" }}>{coin.name}</span></>}<small>{coin.mint}</small></div>
    </div>
  ) : <div className="rz-note" style={{ textAlign: "left" }}>No coin attached yet</div>;

  return (
    <Shell right={
      <button className="rz-btn" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
    }>
      <div className={`rz-card ${step === 2 ? "rz-card-wide" : ""}`}>
        <div className="rz-progress">
          {steps.map((s, i) => (
            <div key={s} className={`rz-pi ${step >= i + 1 ? "on" : ""}`}>
              <span className="rz-dot">{step > i + 1 ? "✓" : ""}</span>{s}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <div className="rz-head">
              <h1>Create your project</h1>
              <p>Three quick questions and a budget. You can save and come back anytime.</p>
            </div>
            <div className="rz-grid">
              <div className="rz-field"><label>Your name</label><input className="rz-in" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></div>
              <div className="rz-field"><label>Project name</label><input className="rz-in" value={title} maxLength={120} placeholder="e.g. Summer EP launch" onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="rz-field rz-full"><label>What are you making?</label><textarea className="rz-in" value={making} maxLength={600} placeholder="A 4-track EP with a music video and cover art" onChange={(e) => setMaking(e.target.value)} /></div>
              <div className="rz-field rz-full"><label>Who is it for? <span className="rz-opt">(optional)</span></label><input className="rz-in" value={audience} maxLength={300} placeholder="Fans of R&B in Toronto, 18–30" onChange={(e) => setAudience(e.target.value)} /></div>
              <div className="rz-field rz-full">
                <label>Budget (CAD)</label>
                <div className="rz-money"><span>$</span><input className="rz-in" inputMode="decimal" value={budget} placeholder="5,000" onChange={(e) => setBudget(e.target.value.replace(/[^0-9.,]/g, ""))} /></div>
              </div>
              <div className="rz-split rz-full">
                <div style={{ fontSize: ".72rem", fontWeight: 600 }}>Where the money goes</div>
                <div className="rz-bar">
                  <i className="rz-c-a" style={{ width: `${artistPct}%` }} />
                  <i className="rz-c-f" style={{ width: `${feePct}%` }} />
                  <i className="rz-c-c" style={{ width: `${causePct}%` }} />
                </div>
                <div className="rz-split-row"><span className="rz-sw rz-c-a" /><span>Artist</span><span className="rz-amt" style={{ fontWeight: 500 }}>{artistPct}%</span><span className="rz-amt">{money(budgetCents * artistPct / 100)}</span></div>
                <div className="rz-split-row"><span className="rz-sw rz-c-f" /><span>Rhozeland fee</span><input className="rz-pct" type="number" min={0} max={100} value={feePct} onChange={(e) => setFeePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /><span className="rz-amt">{money(budgetCents * feePct / 100)}</span></div>
                <div className="rz-split-row"><span className="rz-sw rz-c-c" /><span>Cause</span><input className="rz-pct" type="number" min={0} max={100} value={causePct} onChange={(e) => setCausePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /><span className="rz-amt">{money(budgetCents * causePct / 100)}</span></div>
                {causePct > 0 && <input className="rz-in" style={{ marginTop: ".5rem" }} value={causeName} maxLength={120} placeholder="Which cause? (optional)" onChange={(e) => setCauseName(e.target.value)} />}
              </div>
            </div>
            <div className="rz-actions">
              <button className="rz-btn pri" onClick={goStep2}>Next: Roadmap ›</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="rz-head">
              <h1>Your roadmap</h1>
              <p>We drafted milestones from your answers. Edit, reorder or remove anything.</p>
            </div>
            <SplitMini />
            <div className="rz-inv">
              <div className="rz-inv-h"><span>#</span><span>Milestone</span><span>Deliverable</span><span style={{ textAlign: "right" }}>Amount</span><span /></div>
              {genBusy && [0, 1, 2].map((i) => <div key={i} className="rz-skel" />)}
              {!genBusy && rows.map((r, i) => (
                <div className="rz-row" key={r.id}>
                  <span className="rz-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="rz-row-body">
                    <textarea className="rz-in rz-roadmap-text rz-roadmap-title" rows={2} value={r.title} maxLength={80} aria-label={`Milestone ${i + 1} title`} placeholder="Milestone title" onChange={(e) => updateRow(r.id, { title: e.target.value })} />
                    <textarea className="rz-in rz-roadmap-text rz-roadmap-deliverable" rows={3} value={r.deliverable} maxLength={240} aria-label={`Milestone ${i + 1} deliverable`} placeholder="Specific deliverable, quantity, format and approval criteria" onChange={(e) => updateRow(r.id, { deliverable: e.target.value })} />
                    <div className="rz-money"><span>$</span><input className="rz-in" style={{ textAlign: "right", fontSize: ".78rem" }} inputMode="decimal" value={r.amount_cents ? String(r.amount_cents / 100) : ""} placeholder="0" onChange={(e) => updateRow(r.id, { amount_cents: Math.round((parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0) * 100) })} /></div>
                  </div>
                  <div className="rz-row-ctrl">
                    <button className="rz-ico" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={13} /></button>
                    <button className="rz-ico" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ChevronDown size={13} /></button>
                    <button className="rz-ico" aria-label="Delete" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
              <div className="rz-inv-f">
                <span>Total {rowsTotal !== budgetCents && <span className="rz-warn">· budget is {money(budgetCents)}</span>}</span>
                <strong>{money(rowsTotal)}</strong>
              </div>
            </div>
            <div className="rz-actions" style={{ marginTop: ".9rem" }}>
              <button className="rz-btn" disabled={rows.length >= 12 || genBusy} onClick={() => setRows((rs) => [...rs, { id: uid(), title: "", deliverable: "", amount_cents: 0 }])}><Plus size={13} /> Add row</button>
              <button className="rz-btn" disabled={genBusy} onClick={generate}>{rows.length ? <RefreshCw size={13} /> : <Sparkles size={13} />} {genBusy ? "Generating…" : rows.length ? "Regenerate" : "Generate"}</button>
            </div>
            <div className="rz-actions">
              <button className="rz-btn" onClick={() => { setErr(""); setStep(1); }}>‹ Back</button>
              <button className="rz-btn pri" disabled={genBusy} onClick={goStep3}>Next: Coin ›</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="rz-head">
              <h1>Attach your Pump.fun coin.</h1>
              <p>Already launched on Pump.fun? Paste the mint address so fans can hold it to unlock your work.</p>
            </div>
            <div className="rz-grid">
              <div className="rz-field rz-full">
                <label>Mint address</label>
                <input className="rz-in" value={mint} maxLength={60} placeholder="Paste mint address" spellCheck={false} onChange={(e) => setMint(e.target.value.trim())} />
                {coinErr && <div className="rz-err" style={{ textAlign: "left" }}>{coinErr}</div>}
              </div>
              <div className="rz-field" style={{ maxWidth: 200 }}>
                <label>Ticker</label>
                <div className="rz-money"><span>$</span><input className="rz-in" value={ticker.replace(/^\$/, "")} maxLength={12} placeholder="SUMMER" onChange={(e) => setTicker(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></div>
              </div>
              <div className="rz-field rz-full">
                {coinBusy && <div className="rz-note" style={{ textAlign: "left" }}>Looking up coin…</div>}
                {(mint.trim() || tick) && (coin ? <CoinChip /> : tick ? <div className="rz-coin"><div><b>${tick}</b><small>Add a valid mint address to attach</small></div></div> : null)}
                <div style={{ marginTop: ".55rem" }}><button className="rz-textlink" onClick={skipCoin}>Skip for now</button></div>
              </div>
            </div>
            <div className="rz-actions">
              <button className="rz-btn" onClick={() => { setErr(""); setStep(2); }}>‹ Back</button>
              <button className="rz-btn pri" disabled={coinBusy} onClick={goStep4}>Next: Review ›</button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="rz-head">
              <h1>Review and publish</h1>
              <p>Check everything below. You can go back to edit any step.</p>
            </div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Project</span><b style={{ wordBreak: "break-word" }}>{title}</b></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Artist</span><span>{name}</span></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Budget</span><b>{money(budgetCents)}</b></div>
            </div>
            <SplitMini />
            <div className="rz-inv" style={{ marginBottom: ".9rem" }}>
              {rows.map((m, i) => (
                <div key={m.id} className="rz-row" style={{ gridTemplateColumns: "1.6rem 1fr auto", fontSize: ".78rem" }}>
                  <span className="rz-num" style={{ paddingTop: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ minWidth: 0 }}><b>{m.title}</b><div style={{ color: "hsl(var(--mut))", fontSize: ".72rem", marginTop: ".15rem" }}>{m.deliverable}</div></div>
                  <span className="rz-amt">{money(m.amount_cents)}</span>
                </div>
              ))}
              <div className="rz-inv-f"><span>Total</span><strong>{money(rowsTotal)}</strong></div>
            </div>
            <div style={{ fontSize: ".72rem", fontWeight: 600 }}>Coin</div>
            <CoinChip />
            <div className="rz-actions">
              <button className="rz-btn" onClick={() => { setErr(""); setStep(3); }}>‹ Back</button>
              <button className="rz-btn pri" disabled={publishing} onClick={publish}>{publishing ? "Publishing…" : "Publish project"}</button>
            </div>
            <div style={{ textAlign: "center", marginTop: ".6rem" }}><button className="rz-textlink" disabled={saving} onClick={() => save(4)}>{saving ? "Saving…" : "Save as draft"}</button></div>
            <p className="rz-note">Publishing creates a public page anyone with the link can view.</p>
          </>
        )}

        {err && <div className="rz-err">{err}</div>}
        {savedAt && <div className="rz-note rz-saved">Draft saved {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>}
      </div>
    </Shell>
  );
}
