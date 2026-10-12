import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { money, uid } from "./shared";
import "./workspace.css";

type Milestone = { id?: string; title: string; deliverable: string; amount_cents: number; done?: boolean };
type Tab = "overview" | "plan" | "team" | "money";
export type PublicSections = { overview: boolean; plan: boolean; team: boolean; money: boolean };

export const DEFAULT_PUBLIC_SECTIONS: PublicSections = { overview: true, plan: true, team: true, money: true };

const TOKEN_KEY = "rz_release_token";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAKERS_OPTIONS: { value: string; label: string }[] = [
  { value: "rhoze", label: "Work with Rhozeland" },
  { value: "own", label: "My own team" },
  { value: "open", label: "Open roles" },
];

/** Owner-only workspace: Overview, Plan, Team & chat, Money tabs, each with a public-visibility switch.
 *  Saves through the existing owner-checked release_save(p_token, p_id, p_data) function. */
export default function ProjectWorkspace({ r, onSaved }: { r: any; onSaved: (next: any) => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [milestones, setMilestones] = useState<Milestone[]>(() => (r.milestones || []).map((m: any) => ({ id: m.id || uid(), title: m.title || "", deliverable: m.deliverable || "", amount_cents: Number(m.amount_cents) || 0, done: !!m.done })));
  const [makers, setMakers] = useState<string>(r.answers?.makers?.mode || (Array.isArray(r.answers?.roles) && r.answers.roles.length ? "open" : "own"));
  const [pub, setPub] = useState<PublicSections>({ ...DEFAULT_PUBLIC_SECTIONS, ...(r.answers?.public_sections || {}) });
  const [artistPct, setArtistPct] = useState(Number(r.artist_pct) || 0);
  const [feePct, setFeePct] = useState(Number(r.fee_pct) || 0);
  const [causePct, setCausePct] = useState(Number(r.cause_pct) || 0);
  const [mint, setMint] = useState(r.coin_mint || "");
  const [ticker, setTicker] = useState(r.coin_ticker || "");
  const [coinBusy, setCoinBusy] = useState(false);
  const [coinErr, setCoinErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const splitTotal = Math.round(artistPct + feePct + causePct);

  const buildPayload = (overrides: Record<string, any> = {}) => ({
    title: r.title, creator_name: r.creator_name, creator_email: r.creator_email, booking_id: r.booking_id,
    answers: { ...(r.answers || {}), public_sections: pub, makers: { ...(r.answers?.makers || {}), mode: makers } },
    budget_cents: r.budget_cents,
    artist_pct: artistPct, fee_pct: feePct, cause_pct: causePct, cause_name: r.cause_name,
    milestones: milestones.map(({ id, ...m }) => m),
    coin_mint: mint.trim(), coin_ticker: ticker.trim(), coin_name: r.coin_name, coin_image: r.coin_image,
    cover_url: r.cover_url, payout_wallet: r.payout_wallet, current_step: r.current_step,
    ...overrides,
  });

  const save = async (overrides: Record<string, any> = {}) => {
    setBusy(true); setErr("");
    const token = localStorage.getItem(TOKEN_KEY) || uid() + uid();
    localStorage.setItem(TOKEN_KEY, token);
    const payload = buildPayload(overrides);
    const { error } = await (supabase.rpc as any)("release_save", { p_token: token, p_id: r.id, p_data: payload });
    setBusy(false);
    if (error) { setErr("Couldn't save your changes. Please try again."); return; }
    setSavedAt(Date.now());
    onSaved({ ...r, ...payload, milestones: payload.milestones });
  };

  const setPublic = (key: keyof PublicSections, value: boolean) => {
    const next = { ...pub, [key]: value };
    setPub(next);
    save({ answers: { ...(r.answers || {}), public_sections: next, makers: { ...(r.answers?.makers || {}), mode: makers } } });
  };

  const addMilestone = () => setMilestones((m) => [...m, { id: uid(), title: "", deliverable: "", amount_cents: 0, done: false }]);
  const updateMilestone = (i: number, patch: Partial<Milestone>) => setMilestones((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const removeMilestone = (i: number) => setMilestones((m) => m.filter((_, j) => j !== i));

  const lookupCoin = async () => {
    const m = mint.trim();
    setCoinErr("");
    if (!MINT_RE.test(m)) { setCoinErr("That doesn't look like a valid mint address."); return; }
    setCoinBusy(true);
    try {
      const { data } = await supabase.functions.invoke("pumpfun-coin", { body: { mint: m } });
      if (data?.ticker) setTicker((t) => t || data.ticker);
      else setCoinErr("Coin not found yet — you can still save the address.");
    } catch { setCoinErr("Couldn't look up that coin right now."); }
    setCoinBusy(false);
  };

  const PublicSwitch = ({ sectionKey, label }: { sectionKey: keyof PublicSections; label: string }) => (
    <span className="rz-ws-pub">
      <Switch checked={pub[sectionKey]} onCheckedChange={(v) => setPublic(sectionKey, v)} aria-label={`${label} visible publicly`} />
      Show publicly
    </span>
  );

  const openRoles = useMemo(() => (Array.isArray(r.answers?.roles) ? r.answers.roles.length : 0), [r.answers?.roles]);

  return (
    <div className="rz-ws">
      <div className="rz-ws-tabs" role="tablist" aria-label="Project workspace">
        {([["overview", "Overview"], ["plan", "Plan"], ["team", "Team & chat"], ["money", "Money"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} type="button" className="rz-ws-tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="rz-ws-panel-head"><h3>Overview</h3><PublicSwitch sectionKey="overview" label="Overview" /></div>
          <p className="rz-ws-note">The title, cover and description shown above come from your project details. Edit them from <a className="rz-textlink" href={`/create.html?draft=${r.id}`}>Edit project</a>.</p>
        </div>
      )}

      {tab === "plan" && (
        <div>
          <div className="rz-ws-panel-head"><h3>Plan — roadmap &amp; deliverables</h3><PublicSwitch sectionKey="plan" label="Plan" /></div>
          {milestones.map((m, i) => (
            <div className="rz-ws-milestone" key={m.id ?? i}>
              <input type="checkbox" checked={!!m.done} onChange={(e) => updateMilestone(i, { done: e.target.checked })} aria-label={`Mark milestone ${i + 1} done`} style={{ marginTop: ".4rem" }} />
              <div className="rz-ws-milestone-fields">
                <input className="rz-in" placeholder="Milestone title" value={m.title} onChange={(e) => updateMilestone(i, { title: e.target.value })} />
                <input className="rz-in" placeholder="Deliverable" value={m.deliverable} onChange={(e) => updateMilestone(i, { deliverable: e.target.value })} />
                <input className="rz-in" type="number" min={0} placeholder="Amount (cents)" value={m.amount_cents || ""} onChange={(e) => updateMilestone(i, { amount_cents: Math.max(0, parseInt(e.target.value) || 0) })} />
                <span className="rz-ws-note">{money(m.amount_cents || 0)}</span>
              </div>
              <button type="button" className="rz-btn" onClick={() => removeMilestone(i)} aria-label={`Remove milestone ${i + 1}`}>Remove</button>
            </div>
          ))}
          <div className="rz-ws-save">
            <button type="button" className="rz-btn" onClick={addMilestone}>Add milestone</button>
            <button type="button" className="rz-btn pri" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save plan"}</button>
            {savedAt && <span className="rz-ws-note">Saved</span>}
          </div>
        </div>
      )}

      {tab === "team" && (
        <div>
          <div className="rz-ws-panel-head"><h3>Team &amp; chat</h3><PublicSwitch sectionKey="team" label="Team & chat" /></div>
          <p className="rz-ws-note">Who's making it</p>
          <div className="rz-ws-makers">
            {MAKERS_OPTIONS.map((o) => (
              <label key={o.value}><input type="radio" name="rz-ws-makers" checked={makers === o.value} onChange={() => setMakers(o.value)} />{o.label}</label>
            ))}
          </div>
          {openRoles > 0 && <p className="rz-ws-note">{openRoles} open {openRoles === 1 ? "role" : "roles"} listed below on the public page.</p>}
          <div className="rz-ws-save">
            <button type="button" className="rz-btn pri" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save team"}</button>
            <a className="rz-btn" href="/messages">Open Messages</a>
            {savedAt && <span className="rz-ws-note">Saved</span>}
          </div>
        </div>
      )}

      {tab === "money" && (
        <div>
          <div className="rz-ws-panel-head"><h3>Money</h3><PublicSwitch sectionKey="money" label="Money" /></div>
          <div className="rz-ws-split-row"><span>Artist %</span><input className="rz-in" type="number" min={0} max={100} value={artistPct} onChange={(e) => setArtistPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <div className="rz-ws-split-row"><span>Rhozeland fee %</span><input className="rz-in" type="number" min={0} max={100} value={feePct} onChange={(e) => setFeePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <div className="rz-ws-split-row"><span>Cause %</span><input className="rz-in" type="number" min={0} max={100} value={causePct} onChange={(e) => setCausePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <p className="rz-ws-note">{splitTotal === 100 ? "Totals 100%" : `Must total 100% (currently ${splitTotal}%)`}</p>
          <div className="rz-ws-row" style={{ marginTop: ".8rem" }}>
            <input className="rz-in" placeholder="Coin mint address" value={mint} onChange={(e) => setMint(e.target.value)} />
            <input className="rz-in" placeholder="Ticker" style={{ maxWidth: "7rem" }} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
            <button type="button" className="rz-btn" disabled={coinBusy} onClick={lookupCoin}>{coinBusy ? "Checking…" : "Look up"}</button>
          </div>
          {coinErr && <p className="rz-ws-note">{coinErr}</p>}
          <div className="rz-ws-save">
            <button type="button" className="rz-btn pri" disabled={busy || splitTotal !== 100} onClick={() => save()}>{busy ? "Saving…" : "Save money"}</button>
            {savedAt && <span className="rz-ws-note">Saved</span>}
          </div>
        </div>
      )}
      {err && <p className="rz-note" style={{ marginTop: ".6rem" }}>{err}</p>}
    </div>
  );
}
