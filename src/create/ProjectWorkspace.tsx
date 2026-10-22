import ProjectCall from "./ProjectCall";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import TeamPlanner from "./TeamPlanner";
import ProjectPayments from "./ProjectPayments";
import { saveTeam } from "./team-storage";
import { useEffect } from "react";
import type { TeamPerson } from "./project-flow";
import { money, uid } from "./shared";
import "./workspace.css";
import "./create-flow.css";
import { tokenPairingError, TOKEN_PAIRING_NOTICE } from "./token-pairing";

type Milestone = { id?: string; title: string; deliverable: string; amount_cents: number; done?: boolean };
type Tab = "overview" | "plan" | "team" | "money" | "payments";
export type PublicSections = { overview: boolean; plan: boolean; team: boolean; money: boolean };

export const DEFAULT_PUBLIC_SECTIONS: PublicSections = { overview: true, plan: false, team: false, money: false };

const TOKEN_KEY = "rz_release_token";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAKERS_OPTIONS: { value: string; label: string }[] = [
  { value: "rhozeland", label: "Work with Rhozeland" },
  { value: "own_team", label: "My own team" },
  { value: "open_roles", label: "Open roles" },
];

/** Owner-only workspace: Overview, Plan, Team & chat, Money tabs, each with a public-visibility switch.
 *  Saves through the existing owner-checked release_save(p_token, p_id, p_data) function. */
export default function ProjectWorkspace({ r, onSaved }: { r: any; onSaved: (next: any) => void }) {
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get("paid") ? "payments" : "overview"));
  const [milestones, setMilestones] = useState<Milestone[]>(() => (r.milestones || []).map((m: any) => ({ id: m.id || uid(), title: m.title || "", deliverable: m.deliverable || "", amount_cents: Number(m.amount_cents) || 0, done: !!m.done })));
  const [makers, setMakers] = useState<string[]>(Array.isArray(r.answers?.makers) ? r.answers.makers : []);
  const [people, setPeople] = useState<TeamPerson[]>([]);
  const [title, setTitle] = useState(r.title || "");
  const [description, setDescription] = useState(r.answers?.description || "");
  const [story, setStory] = useState(r.answers?.story || "");
  const [context, setContext] = useState(r.answers?.cultural_context || "");
  const [contribution, setContribution] = useState(r.answers?.rhozeland_contribution || "");
  const [source, setSource] = useState(r.answers?.source_url || "");
  const [mediaLinks, setMediaLinks] = useState<string>((r.answers?.media_links || []).join("\n"));
  const [budget, setBudget] = useState(String((r.budget_cents || 0) / 100));
  const [deadline, setDeadline] = useState(r.answers?.deadline || "");
  const [timeline, setTimeline] = useState(r.answers?.timeline || "Flexible");
  useEffect(() => {
    supabase.from("release_team_members").select("creator_id,display_name,email").eq("release_id", r.id).then(({ data }) => setPeople(data || []));
  }, [r.id]);
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
    title: title.trim(), creator_name: r.creator_name, creator_email: r.creator_email, booking_id: r.booking_id,
    answers: { ...(r.answers || {}), public_sections: pub, makers, description: description.trim(), deadline, timeline, story: story.trim(), cultural_context: context.trim(), rhozeland_contribution: contribution.trim(), source_url: source.trim(), media_links: mediaLinks.split(/\s+/).map((x) => x.trim()).filter((x) => /^https?:\/\/\S+$/i.test(x)).slice(0, 24) },
    budget_cents: Math.max(0, Math.round(Number(budget) * 100) || 0),
    artist_pct: artistPct, fee_pct: feePct, cause_pct: causePct, cause_name: r.cause_name,
    milestones: milestones.map(({ id, ...m }) => m),
    coin_mint: mint.trim(), coin_ticker: ticker.trim(), coin_name: r.coin_name, coin_image: r.coin_image,
    cover_url: r.cover_url, payout_wallet: r.payout_wallet, current_step: r.current_step,
    ...overrides,
  });

  const save = async (overrides: Record<string, any> = {}) => {
    const invalid = tokenPairingError(mint);
    if (invalid) { setErr(invalid); return; }
    if (source.trim() && !/^https?:\/\/\S+$/i.test(source.trim())) { setErr("Use a complete https:// link for the original work."); return; }
    setBusy(true); setErr("");
    const token = localStorage.getItem(TOKEN_KEY) || uid() + uid();
    localStorage.setItem(TOKEN_KEY, token);
    const payload = buildPayload(overrides);
    const { error } = await (supabase.rpc as any)("release_save", { p_token: token, p_id: r.id, p_data: payload });
    if (!error) { try { await saveTeam(r.id, people); } catch { setBusy(false); setErr("Project saved, but team changes could not be saved."); return; } }
    setBusy(false);
    if (error) { setErr("Couldn't save your changes. Please try again."); return; }
    setSavedAt(Date.now());
    onSaved({ ...r, ...payload, milestones: payload.milestones });
  };

  const setPublic = (key: keyof PublicSections, value: boolean) => {
    const next = { ...pub, [key]: value };
    setPub(next);
    save({ answers: { ...buildPayload().answers, public_sections: next } });
  };

  const generateRoadmap = async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.functions.invoke("release-roadmap", { body: { title, answers: { ...r.answers, description }, budget_cents: Math.round(Number(budget) * 100), artist_pct: artistPct } });
    setBusy(false);
    if (error || !Array.isArray(data?.milestones)) { setErr("Couldn't generate a roadmap. Add milestones manually or try again."); return; }
    setMilestones(data.milestones.map((m: Milestone) => ({ ...m, id: uid(), done: false })));
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
      <ProjectCall releaseId={r.id} />
      <div className="rz-ws-tabs" role="tablist" aria-label="Project workspace">
        {([["overview", "Details"], ["plan", "Roadmap"], ["team", "People"], ["money", "Budget"], ["payments", "Payments & schedule"]] as [Tab, string][]).map(([k, label]) => (
          <Button variant="outline" key={k} type="button" className="rz-ws-tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</Button>
        ))}
      </div>

      {tab === "overview" && (
        <div>
          <div className="rz-ws-panel-head"><h3>Overview</h3><PublicSwitch sectionKey="overview" label="Overview" /></div>
          <label>Project name<input className="rz-in" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>Brief description<textarea className="rz-in" value={description} maxLength={600} rows={4} onChange={(e) => setDescription(e.target.value)} /></label>
          <label>The story<textarea className="rz-in" value={story} maxLength={10000} rows={5} onChange={(e) => setStory(e.target.value)} /></label>
          <label>Cultural context<textarea className="rz-in" value={context} maxLength={10000} rows={4} onChange={(e) => setContext(e.target.value)} /></label>
          <label>Rhozeland's contribution<textarea className="rz-in" value={contribution} maxLength={10000} rows={4} onChange={(e) => setContribution(e.target.value)} /></label>
          <label>Original work / source link<input className="rz-in" type="url" value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://" /></label>
          <label>Media &amp; links <small>— one per line: YouTube, Vimeo, Spotify, SoundCloud, images, Instagram, TikTok, Eventbrite, Luma, your site</small><textarea className="rz-in" value={mediaLinks} rows={4} onChange={(e) => setMediaLinks(e.target.value)} placeholder={"https://youtu.be/…\nhttps://lu.ma/…"} /></label>
          <div className="rz-ws-save"><Button variant="outline" className="rz-btn pri" disabled={busy || !title.trim()} onClick={() => save()}>Save details</Button><Button variant="outline" className="rz-btn" asChild><a href={`/create.html?draft=${r.id}`}>Edit all details</a></Button></div>
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
                <input className="rz-in" type="number" min={0} aria-label={`Milestone ${i + 1} budget (CAD)`} placeholder="Budget (CAD)" value={m.amount_cents / 100 || ""} onChange={(e) => updateMilestone(i, { amount_cents: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) })} />
                <span className="rz-ws-note">{money(m.amount_cents || 0)}</span>
              </div>
              <Button variant="outline" type="button" className="rz-btn" onClick={() => removeMilestone(i)} aria-label={`Remove milestone ${i + 1}`}>Remove</Button>
            </div>
          ))}
          <div className="rz-ws-save">
            <Button variant="outline" type="button" className="rz-btn" onClick={addMilestone}>Add milestone</Button>
             <Button variant="outline" className="rz-btn" disabled={busy} onClick={generateRoadmap}>Generate with AI</Button>
            <Button variant="outline" type="button" className="rz-btn pri" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save plan"}</Button>
            {savedAt && <span className="rz-ws-note">Saved</span>}
          </div>
        </div>
      )}

      {tab === "team" && (
        <div>
          <div className="rz-ws-panel-head"><h3>People</h3><PublicSwitch sectionKey="team" label="Team & chat" /></div>
          <TeamPlanner people={people} onChange={setPeople} />
          <div className="rz-ws-makers">
            {MAKERS_OPTIONS.map((o) => (
              <label key={o.value}><input type="checkbox" checked={makers.includes(o.value)} onChange={() => setMakers((prev) => prev.includes(o.value) ? prev.filter((x) => x !== o.value) : [...prev, o.value])} />{o.label}</label>
            ))}
          </div>
          {openRoles > 0 && <p className="rz-ws-note">{openRoles} open {openRoles === 1 ? "role" : "roles"} listed below on the public page.</p>}
          <div className="rz-ws-save">
            <Button variant="outline" type="button" className="rz-btn pri" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : "Save team"}</Button>
            <a className="rz-btn" href="/messages">Open Messages</a>
            {savedAt && <span className="rz-ws-note">Saved</span>}
          </div>
        </div>
      )}

      {tab === "money" && (
        <div>
          <div className="rz-ws-panel-head"><h3>Budget</h3><PublicSwitch sectionKey="money" label="Money" /></div>
          <label>Planning budget (CAD)<input className="rz-in" type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
          <label>Target date<input className="rz-in" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          <label>Flexible timeline<select className="rz-in" value={timeline} onChange={(e) => setTimeline(e.target.value)}>{["1 week", "2 weeks", "1 month", "3 months", "Flexible"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <p className="rz-ws-note">Planning only · applicable taxes may be added to the final estimate. No money has been paid.</p>
          <div className="rz-ws-split-row"><span>Project %</span><input className="rz-in" type="number" min={0} max={100} value={artistPct} onChange={(e) => setArtistPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <div className="rz-ws-split-row"><span>Rhozeland fee %</span><input className="rz-in" type="number" min={0} max={100} value={feePct} onChange={(e) => setFeePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <div className="rz-ws-split-row"><span>Cause %</span><input className="rz-in" type="number" min={0} max={100} value={causePct} onChange={(e) => setCausePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></div>
          <p className="rz-ws-note">{splitTotal === 100 ? "Totals 100%" : `Must total 100% (currently ${splitTotal}%)`}</p>
          <div className="rz-ws-row" style={{ marginTop: ".8rem" }}>
            <input className="rz-in" aria-label="Solana contract address" placeholder="Solana contract address · optional" value={mint} onChange={(e) => { setMint(e.target.value); setTicker(""); }} />
            <input className="rz-in" placeholder="Ticker" style={{ maxWidth: "7rem" }} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />
            <Button variant="outline" type="button" className="rz-btn" disabled={coinBusy} onClick={lookupCoin}>{coinBusy ? "Checking…" : "Look up"}</Button>
          </div>
          <p className="rz-ws-note">{TOKEN_PAIRING_NOTICE}</p>
          {coinErr && <p className="rz-ws-note">{coinErr}</p>}
          <div className="rz-ws-save">
            <Button variant="outline" type="button" className="rz-btn pri" disabled={busy || splitTotal !== 100} onClick={() => save()}>{busy ? "Saving…" : "Save money"}</Button>
            {savedAt && <span className="rz-ws-note">Saved</span>}
          </div>
        </div>
      )}
      {tab === "payments" && <div><div className="rz-ws-panel-head"><h3>Payments &amp; schedule</h3></div><ProjectPayments r={r} /></div>}
      {err && <p className="rz-note" style={{ marginTop: ".6rem" }}>{err}</p>}
    </div>
  );
}
