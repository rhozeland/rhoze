import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, RefreshCw, Sparkles, Check, ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, Milestone, money, uid } from "./shared";
import AuthModal from "./AuthModal";
import BookCallStep, { type CallChoice } from "./BookCallStep";
import { fmtSlot } from "./call-slots";
import CoverEditor from "./CoverEditor";
import { LocationFields } from "./ProfileExtras";
import { Button } from "@/components/ui/button";
import "./create-flow.css";
import ExistingProjects from "./ExistingProjects";
import TeamPlanner from "./TeamPlanner";
import RhozelandTeam from "./RhozelandTeam";
import { saveTeam } from "./team-storage";
import { PROJECT_GOALS, flowForGoal, goalDefaults, type ProjectGoal, COIN_CHOICES, FEE_LABEL, type CoinChoice, IDEA_SCREENS, IDEA_SCREEN_TITLES, FLEXIBLE_TIMELINES, scopeError, validateIdeaQuestion, type TeamPerson } from "./project-flow";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info, Share2, Handshake, CalendarCheck, Coins, Rocket, ImagePlus, ChevronRight } from "lucide-react";
import "./create-modern.css";
import { tokenPairingError, TOKEN_PAIRING_NOTICE } from "./token-pairing";
import { RHOZE_MINT } from "@/lib/rhozeChain";
import { completeDraftHandoff, PENDING_DRAFT_KEY } from "./draft-handoff";
import RoleDetails from './RoleDetails';
import { ROLE_DETAIL_FIELDS, firstRoleMissingDetails, roleDetails, type RoleDetails as RoleDetailValues } from './role-details';

const TOKEN_KEY = "rz_release_token";
const DRAFT_KEY = "rz_release_draft";
const PENDING_KEY = "rz_pending_workspace";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function getToken() {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) { t = uid() + uid(); localStorage.setItem(TOKEN_KEY, t); }
  return t;
}

type Role = { id: string; name: string; count: string; rate: string } & RoleDetailValues;
type PType = "artist" | "brand";

// The wizard is now a single merged 4-step flow shared by both project types.
type StepKey = "idea" | "scope" | "team" | "call" | "review";
const FLOW: StepKey[] = ["idea", "scope", "team", "call", "review"];
const STEP_LABEL: Record<StepKey, string> = { idea: "The idea", scope: "Scope", team: "Who's making it", call: "Book a call", review: "Review" };
const CALL_KEY = "rz_pending_call";
const STEP_SHORT: Record<StepKey, string> = { idea: "Basics", scope: "Scope", team: "Team", call: "Call", review: "Review" };
const GOAL_ICONS: Record<ProjectGoal, typeof Share2> = { share: Share2, assist: Handshake, book: CalendarCheck, coin_existing: Coins, coin_launch: Rocket };

// Old (pre-merge) step keys map onto the new 4 steps so drafts saved by the
// previous wizard still reopen at a sensible place.
const OLD_TO_NEW: Record<string, StepKey> = {
  type: "idea", details: "idea", brief: "idea", description: "idea", cover: "idea",
  budget: "scope",
  split: "team", roadmap: "team", roles: "team", coin: "team",
  publish: "review",
};
const OLD_LEGACY_ORDER = ["type", "details", "roadmap", "roles", "coin", "publish"];

const CATEGORIES = ["Music", "Film & Video", "Art & Design", "Fashion", "Brand campaigns"] as const;
const TIMELINES = FLEXIBLE_TIMELINES;
const MAKERS = [
  { id: "rhozeland", title: "Work with Rhozeland", desc: "We match you with vetted creative talent." },
  { id: "own_team", title: "My own team", desc: "You already have the people for this." },
  { id: "open_roles", title: "Open roles", desc: "Post roles and let creators apply." },
] as const;

type Coin = { mint: string; ticker: string; name: string; image: string | null } | null;

const GEN_STAGES = [
  { label: "Reading your brief", detail: "Reading what you're making, who it's for, and the budget you set." },
  { label: "Splitting the budget", detail: "Dividing your budget into milestones you can pay out as the work lands." },
  { label: "Writing deliverables", detail: "Writing exactly what you'll deliver at each milestone, and in what format." },
  { label: "Setting approval checks", detail: "Adding what \"done\" means for each milestone, so nothing stays vague." },
  { label: "Checking the totals", detail: "Making sure the milestone amounts add up to your budget." },
];

function GenProgress({ title }: { title: string }) {
  const [pct, setPct] = useState(4);
  useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => {
      const s = (Date.now() - t0) / 1000;
      setPct(4 + 90 * (1 - Math.exp(-s / 7)));
    }, 100);
    return () => clearInterval(t);
  }, []);
  const stage = pct >= 88 ? 4 : pct >= 68 ? 3 : pct >= 45 ? 2 : pct >= 22 ? 1 : 0;
  return (
    <div className="rz-gen" role="status" aria-live="polite">
      <div className="rz-gen-top">
        <h2>Writing your roadmap{title.trim() ? ` for ${title.trim()}` : ""}</h2>
        <span className="rz-gen-pct">{Math.round(pct)}%</span>
      </div>
      <div className="rz-gen-bar"><i style={{ width: `${pct}%` }} /></div>
      <p className="rz-gen-now">
        <span className="rz-gen-dots" aria-hidden="true"><i /><i /><i /></span>
        {GEN_STAGES[stage].detail}
      </p>
      <ul className="rz-gen-steps">
        {GEN_STAGES.map((s, i) => (
          <li key={s.label} className={`rz-gen-step${i === stage ? " on" : ""}${i < stage ? " done" : ""}`}>
            {i < stage ? <Check size={11} aria-hidden="true" /> : <span className="rz-gen-dot" aria-hidden="true" />}
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CreateProject() {
  const token = useMemo(getToken, []);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [ptype, setPtype] = useState<PType>("artist");
  const [ideaIndex, setIdeaIndex] = useState(0);
  const [goal, setGoal] = useState<ProjectGoal | "">("");
  const flow = flowForGoal(goal);
  const [originalAnswers, setOriginalAnswers] = useState<Record<string, unknown>>({});
  const [people, setPeople] = useState<TeamPerson[]>([]);
  const [timelineMode, setTimelineMode] = useState("flexible");
  const [deadline, setDeadline] = useState("");
  const [stepKey, setStepKey] = useState<StepKey>("idea");
  const [talentPct, setTalentPct] = useState(15);
  const [roles, setRoles] = useState<Role[]>([]);
  const step = Math.max(1, flow.indexOf(stepKey) + 1);
  const isBrand = ptype === "brand";
  const leadLabel = isBrand ? "Brand" : "Artist";
  const causeLabel = isBrand ? "Project" : "Cause";
  const tPct = isBrand ? talentPct : 0;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [callChoice, setCallChoice] = useState<CallChoice>(() => { try { return JSON.parse(localStorage.getItem(CALL_KEY) || "null"); } catch { return null; } });
  const [title, setTitle] = useState("");
  const [making, setMaking] = useState("");
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState("");
  const [descBusy, setDescBusy] = useState(false);
  const [descErr, setDescErr] = useState("");
  const [desc, setDesc] = useState("");
  const [audience, setAudience] = useState("");
  const [category, setCategory] = useState<string>("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [budget, setBudget] = useState("");
  const [needQuote, setNeedQuote] = useState(false);
  const [timeline, setTimeline] = useState("");
  const [makers, setMakers] = useState<string[]>([]);
  const [feePct, setFeePct] = useState(10);
  const [causePct, setCausePct] = useState(10);
  const [causeName, setCauseName] = useState("");
  const [rows, setRows] = useState<Milestone[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [mint, setMint] = useState("");
  const [coinChoice, setCoinChoice] = useState<CoinChoice>("skip");
  const [ticker, setTicker] = useState("");
  const [meta, setMeta] = useState<{ mint: string; name: string; image: string | null } | null>(null);
  const [coinErr, setCoinErr] = useState("");
  const [wallet, setWallet] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [cover, setCover] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverFile, setCoverFile] = useState<Blob | null>(null);
  const [coverSource, setCoverSource] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [coverDrag, setCoverDrag] = useState(false);

  // Default "This is for" from the signed-in user's own profile kind, when available.
  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data } = await (supabase.rpc as any)("my_profile", {});
        const k = (data as any)?.kind;
        if (k === "brand") setPtype((p) => (p === "artist" ? "brand" : p));
      } catch { /* default stays artist */ }
    })();
  }, []);

  useEffect(() => {
    if (!cover) { setCoverPreview(null); return; }
    let active = true;
    let url: string | null = null;
    fetch(cover).then((response) => { if (!response.ok) throw new Error("Image unavailable"); return response.blob(); }).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob); setCoverPreview(url);
    }).catch(() => { if (active) setCoverPreview(null); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [cover]);
  const [authFor, setAuthFor] = useState<string | null>(null);
  const [savingToProfile, setSavingToProfile] = useState(false);
  const draftHandoffBusy = useRef(false);

  const budgetCents = Math.max(0, Math.round((parseFloat(budget.replace(/[^0-9.]/g, "")) || 0) * 100));
  const artistPct = Math.max(0, 100 - feePct - causePct - tPct);
  const mintOk = MINT_RE.test(mint.trim());
  const tick = ticker.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  const coin: Coin = coinChoice === "own" && mintOk ? { mint: mint.trim(), ticker: tick, name: meta?.mint === mint.trim() ? meta.name : tick, image: meta?.mint === mint.trim() ? meta.image : null } : null;
  const rowsTotal = rows.reduce((s, r) => s + (r.amount_cents || 0), 0);

  const applySplitDefaults = (t: PType) => {
    if (t === "brand") { setFeePct(10); setCausePct(5); setTalentPct(15); }
    else { setFeePct(10); setCausePct(10); }
  };

  const chooseType = (t: PType) => {
    if (t !== ptype) applySplitDefaults(t);
    setPtype(t);
    if (t === "brand" && !roles.length) setRoles([{ id: uid(), name: "", count: "1", rate: "" }]);
  };

  // Load draft or booking prefill
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    // Create always starts a fresh project; drafts reopen only via ?draft= (Existing Projects) or ?resume=1.
    const id = params.get("draft") || (params.get("resume") === "1" ? localStorage.getItem(DRAFT_KEY) : null);
    if (!id) localStorage.removeItem(DRAFT_KEY);
    let booking: any = {};
    try { booking = JSON.parse(sessionStorage.getItem("rz_booking") || localStorage.getItem("rz_booking") || "{}"); } catch { /* */ }
    const applyBooking = () => {
      if (booking.name) setName(booking.name);
      if (booking.email) setEmail(booking.email);
      if (booking.project) setTitle(booking.project);
      if (booking.description) setMaking(booking.description);
      if (booking.id) setBookingId(booking.id);
    };
    const fromParam = !!params.get("draft");
    if (!id || params.get("new") === "1") { applyBooking(); return; }
    (async () => {
      const { data } = await (supabase.rpc as any)("release_get_draft", { p_token: token, p_id: id });
      const r = Array.isArray(data) ? data[0] : null;
      if (!r || (!fromParam && r.status !== "draft")) { localStorage.removeItem(DRAFT_KEY); applyBooking(); return; }
      setDraftId(r.id);
      setOriginalAnswers(r.answers || {});
      setIdeaIndex(fromParam ? 1 : Math.max(0, Math.min(IDEA_SCREENS.length - 1, Number(r.answers?.idea_question) || 0)));
      setTimelineMode(r.answers?.timeline_mode || "flexible");
      setDeadline(r.answers?.deadline || "");
      const { data: team } = await supabase.from("release_team_members").select("creator_id,display_name,email").eq("release_id", r.id);
      setPeople(team || []);
      const lt: PType = r.answers?.project_type === "brand" ? "brand" : "artist";
      setPtype(lt);
      { setTalentPct(Number(r.answers?.talent_pct ?? 15)); setRoles((r.answers?.roles || []).map((x: any) => ({ id: uid(), name: x.name || "", count: String(x.count ?? ""), rate: x.rate || "", ...roleDetails(x) }))); }

      // Resolve the step to reopen on: new wizard_step keys win, otherwise map
      // the old key (or old numeric current_step) onto the new 4-step flow.
      const restored = r.answers?.wizard_step as string | undefined;
      let resolved: StepKey = "idea";
      if (restored && (FLOW as string[]).includes(restored)) resolved = restored as StepKey;
      else if (restored && OLD_TO_NEW[restored]) resolved = OLD_TO_NEW[restored];
      else { const oldKey = OLD_LEGACY_ORDER[(r.current_step || 1) - 1]; resolved = OLD_TO_NEW[oldKey] || "idea"; }
      setStepKey(fromParam ? "idea" : resolved);

      setName(r.creator_name || booking.name || ""); setEmail(r.creator_email || booking.email || "");
      setTitle(r.title || ""); setMaking(r.answers?.making || ""); setDesc(r.answers?.description || r.answers?.making || ""); setAudience(r.answers?.audience || "");
      setCategory(r.answers?.category || "");
      setCity(r.answers?.city || ""); setCountry(r.answers?.country || "");
      setBudget(r.budget_cents ? String(r.budget_cents / 100) : "");
      setNeedQuote(!!r.answers?.need_quote);
      setTimeline(r.answers?.timeline || "");
      setMakers(Array.isArray(r.answers?.makers) ? r.answers.makers : []);
      if (typeof r.answers?.goal === "string" && PROJECT_GOALS.some((g) => g.id === r.answers.goal)) setGoal(r.answers.goal as ProjectGoal);
      setFeePct(Number(r.fee_pct)); setCausePct(Number(r.cause_pct)); setCauseName(r.cause_name || "");
      setRows((r.milestones || []).map((m: any) => ({ id: uid(), ...m })));
      setCoinChoice(r.coin_mint ? "own" : (r.answers?.coin_choice as CoinChoice) || "skip");
      if (r.coin_mint) { setMint(r.coin_mint); setTicker(r.coin_ticker || ""); setMeta({ mint: r.coin_mint, name: r.coin_name, image: r.coin_image }); }
      setWallet(r.payout_wallet || "");
      setCover(r.cover_url || null);
    })();
  }, [token]);

  const payload = (s = step) => ({
    title: title.trim(), creator_name: name.trim(), creator_email: email.trim(), booking_id: bookingId,
    answers: {
      coin_choice: coinChoice,
      ...originalAnswers, idea_question: ideaIndex, timeline_mode: timelineMode, deadline,
      goal, wizard_step: flow[s - 1] || stepKey, making: making.trim(), description: desc.trim(), audience: audience.trim(),
      category, project_type: ptype, need_quote: needQuote, timeline, makers, city: city.trim(), country,
      ...{ talent_pct: talentPct, roles: roles.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), count: Math.max(1, parseInt(x.count) || 1), rate: x.rate.trim(), ...roleDetails(x) })) },
    },
    budget_cents: budgetCents, artist_pct: artistPct + tPct, fee_pct: feePct, cause_pct: causePct, cause_name: causeName.trim(),
    milestones: rows.map(({ title, deliverable, amount_cents }) => ({ title: title.trim(), deliverable: deliverable.trim(), amount_cents })),
    coin_mint: coin?.mint ?? "", coin_ticker: coin?.ticker ?? "", coin_name: coin?.name ?? "", coin_image: coin?.image ?? "",
    payout_wallet: wallet.trim(), cover_url: cover ?? "", current_step: s,
  });

  const save = async (s = step, includeTeam = true): Promise<string | null> => {
    setSaving(true); setErr("");
    try {
    const { data, error } = await (supabase.rpc as any)("release_save", { p_token: token, p_id: draftId, p_data: payload(s) });
    if (error || !data) { setErr("We couldn't save your draft. Check your connection and try again."); return null; }
    setDraftId(data); localStorage.setItem(DRAFT_KEY, data);
    const u = new URL(location.href); u.searchParams.set("draft", data); u.searchParams.delete("new"); history.replaceState(null, "", u);
    const { data: { session } } = await supabase.auth.getSession();
    if (session && includeTeam) { try { await saveTeam(data, people); } catch { setErr("Project saved, but your team shortlist couldn't be saved. Try again."); return null; } }
    setSavedAt(new Date());
    return data as string;
    } catch { setErr("We couldn't save your draft. Check your connection and try again."); return null; }
    finally { setSaving(false); }
  };

  const finishDraft = async (id: string) => {
    if (draftHandoffBusy.current) return;
    draftHandoffBusy.current = true;
    setSavingToProfile(true); setErr("");
    try {
      const path = await completeDraftHandoff(id, {
        claim: async () => { const { error } = await supabase.rpc("release_claim", { p_token: token }); if (error) throw error; },
        saveTeam: async () => {
          const stored = sessionStorage.getItem(`${PENDING_DRAFT_KEY}_team`);
          await saveTeam(id, stored ? JSON.parse(stored) : people);
        },
        list: async () => { const { data, error } = await supabase.rpc("my_releases"); if (error) throw error; return data || []; },
      });
      localStorage.removeItem(PENDING_DRAFT_KEY);
      sessionStorage.removeItem(`${PENDING_DRAFT_KEY}_team`);
      localStorage.removeItem(DRAFT_KEY);
      location.href = path;
    } catch { setErr("Your draft is saved, but we couldn't add it to your profile. Press Save draft to try again."); }
    finally { draftHandoffBusy.current = false; setSavingToProfile(false); }
  };

  const saveToProfile = async () => {
    if (saving || savingToProfile) return;
    const id = await save(step, false);
    if (!id) return;
    localStorage.removeItem(PENDING_KEY);
    localStorage.setItem(PENDING_DRAFT_KEY, id);
    sessionStorage.setItem(`${PENDING_DRAFT_KEY}_team`, JSON.stringify(people));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAuthFor(id); return; }
    await finishDraft(id);
  };

  const generateBrief = async () => {
    if (briefBusy) return;
    if (!title.trim()) { setBriefErr("Add your project name first."); return; }
    setBriefBusy(true); setBriefErr("");
    try {
      const { data, error } = await supabase.functions.invoke("release-brief", {
        body: { title: title.trim(), project_type: ptype, audience: audience.trim(), seed: making.trim() },
      });
      if (error) throw new Error((data as { error?: string } | null)?.error || error.message);
      const brief = (data as { brief?: string } | null)?.brief;
      if (!brief) throw new Error("The AI returned an empty brief. Try again.");
      setMaking(brief);
    } catch (e) {
      setBriefErr(e instanceof Error ? e.message : "Could not generate a brief.");
    } finally {
      setBriefBusy(false);
    }
  };

  const generateDesc = async () => {
    if (descBusy) return;
    if (!title.trim()) { setDescErr("Add your project name first."); return; }
    setDescBusy(true); setDescErr("");
    try {
      const seed = [making.trim(), desc.trim()].filter(Boolean).join("\n\n");
      const { data, error } = await supabase.functions.invoke("release-brief", {
        body: { title: title.trim(), project_type: ptype, audience: audience.trim(), seed },
      });
      if (error) throw new Error((data as { error?: string } | null)?.error || error.message);
      const brief = (data as { brief?: string } | null)?.brief;
      if (!brief) throw new Error("The AI returned an empty description. Try again.");
      setDesc(brief);
    } catch (e) {
      setDescErr(e instanceof Error ? e.message : "Could not generate a description.");
    } finally {
      setDescBusy(false);
    }
  };

  const generate = async () => {
    setGenBusy(true); setErr("");
    const { data, error } = await supabase.functions.invoke("release-roadmap", {
      body: { title: title.trim(), answers: { making, audience, description: desc }, budget_cents: budgetCents, artist_pct: artistPct },
    });
    setGenBusy(false);
    if (error || !data?.milestones) {
      let msg = "Couldn't generate a roadmap. You can add rows manually.";
      try { const b = await (error as any)?.context?.json?.(); if (b?.error) msg = b.error; } catch { /* */ }
      setErr(msg);
      if (!rows.length) setRows([{ id: uid(), title: "", deliverable: "", amount_cents: budgetCents }]);
      return null;
    }
    const newRows = data.milestones.map((m: any) => ({ id: uid(), ...m }));
    setRows(newRows);
    return newRows;
  };

  const updateRole = (id: string, patch: Partial<Role>) => setRoles((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const pickGoal = (g: ProjectGoal) => {
    setGoal(g);
    setIdeaIndex(1);
    const d = goalDefaults(g);
    if (d.coin) setCoinChoice(d.coin);
    if (d.rhozeland) setMakers((ms) => (ms.includes("rhozeland") ? ms : [...ms, "rhozeland"]));
  };
  const toggleMaker = (id: string) => setMakers((ms) => (ms.includes(id) ? ms.filter((x) => x !== id) : [...ms, id]));

  // Optional existing-token pairing in Scope, retained in old drafts too.
  const lookupRef = useRef(0);
  useEffect(() => {
    const m = mint.trim();
    setCoinErr("");
    if (!m) return;
    if (!MINT_RE.test(m)) return;
    if (meta?.mint === m) return;
    const n = ++lookupRef.current;
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("pumpfun-coin", { body: { mint: m } });
        if (n !== lookupRef.current) return;
        if (data?.ticker) { setMeta({ mint: m, name: data.name, image: data.image }); setTicker(data.ticker); }
      } catch { /* manual ticker still works */ }
    }, 400);
    return () => clearTimeout(t);
  }, [mint]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishPublish = async (id: string) => {
    setPublishing(true); setErr("");
    const { error } = await supabase.rpc("release_claim", { p_token: token });
    if (error) { setPublishing(false); setErr("Couldn't open your workspace. Please try again."); return; }
    try { await saveTeam(id, people); } catch { setPublishing(false); setErr("Couldn't save your team shortlist. Please try again."); return; }
    let call: CallChoice = null; try { call = JSON.parse(localStorage.getItem(CALL_KEY) || "null"); } catch { /* */ }
    if (call) {
      const { error: bookErr } = await (supabase.rpc as any)("book_project_call", { _release_id: id, _slot_start: call.slot, _pay_with_credits: call.pay });
      if (bookErr) { setPublishing(false); setErr(/taken|available/i.test(bookErr.message) ? "That call time was just taken. Go back to Book a call and pick another." : /credits/i.test(bookErr.message) ? "You don't have enough credits. Untick Pay with credits and try again." : "Couldn't book your call. Please try again."); return; }
      localStorage.removeItem(CALL_KEY);
    }
    localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(PENDING_KEY);
    location.href = `/workspace/${id}${call ? "?booked=1" : ""}`;
  };
  const publish = async () => {
    const id = await save(flow.length);
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (callChoice) localStorage.setItem(CALL_KEY, JSON.stringify(callChoice)); else localStorage.removeItem(CALL_KEY);
    if (!session) { localStorage.setItem(PENDING_KEY, id); setAuthFor(id); return; }
    await finishPublish(id);
  };
  useEffect(() => {
    const resume = () => {
      const draft = localStorage.getItem(PENDING_DRAFT_KEY);
      if (draft) { setAuthFor(null); void finishDraft(draft); return; }
      const pending = localStorage.getItem(PENDING_KEY);
      if (pending) { setAuthFor(null); void finishPublish(pending); }
    };
    supabase.auth.getUser().then(({ data }) => { if (data.user) resume(); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setTimeout(resume, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [people]);

  const uploadCover = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setErr("Cover art must be a JPG, PNG or WebP image."); return; }
    if (file.size > 8 * 1024 * 1024) { setErr("Cover art must be 8 MB or smaller."); return; }
    setCoverBusy(true); setErr("");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `covers/drafts/${uid()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
    setCoverBusy(false);
    if (error) { throw new Error("Cover upload failed"); }
    setCover(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    setCoverFile(null);
  };

  const selectCover = (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setErr("Cover art must be a JPG, PNG or WebP image."); return; }
    if (file.size > 8 * 1024 * 1024) { setErr("Cover art must be 8 MB or smaller."); return; }
    setErr(""); setCoverSource(file); setCoverFile(file);
  };

  const dropCover = async (dt: DataTransfer) => {
    const files = Array.from(dt.files || []);
    const f = files.find((x) => /^image\//.test(x.type) || /\.(jpe?g|png|webp)$/i.test(x.name)) || files[0];
    if (f) {
      const type = f.type || (/\.png$/i.test(f.name) ? "image/png" : /\.webp$/i.test(f.name) ? "image/webp" : "image/jpeg");
      selectCover(f.type ? f : new File([f], f.name, { type }));
      return;
    }
    const url = dt.getData("text/uri-list") || dt.getData("text/plain");
    if (!/^https?:\/\//.test(url)) { setErr("Drop a JPG, PNG or WebP photo."); return; }
    setCoverBusy(true);
    try {
      const b = await (await fetch(url)).blob();
      selectCover(new File([b], "cover", { type: b.type }));
    } catch { setErr("Couldn't use that image. Save it to your computer and drop it again."); }
    finally { setCoverBusy(false); }
  };

  useEffect(() => {
    const stop = (e: DragEvent) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); };
    window.addEventListener("dragover", stop); window.addEventListener("drop", stop);
    return () => { window.removeEventListener("dragover", stop); window.removeEventListener("drop", stop); };
  }, []);

  const adjustCover = async () => {
    if (coverSource) { setCoverFile(coverSource); return; }
    if (!cover) return;
    setCoverBusy(true); setErr("");
    try {
      const response = await fetch(cover);
      if (!response.ok) throw new Error("Image unavailable");
      const blob = await response.blob();
      setCoverSource(blob); setCoverFile(blob);
    } catch { setErr("We couldn't open your cover. Please try again."); }
    finally { setCoverBusy(false); }
  };

  const updateRow = (id: string, patch: Partial<Milestone>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const a = [...rs]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const nextLabel = flow[step] ? STEP_LABEL[flow[step]] : null;

  const validateIdea = () => {
    if (!name.trim()) return "Add your name.";
    if (!title.trim()) return "Give your project a name.";
    if (!making.trim()) return "Tell us what you're making.";
    if (!desc.trim()) return "Add a short description of your project.";
    return "";
  };
  const validateScope = () => scopeError(budgetCents, needQuote, timelineMode, timeline, deadline) || (coinChoice === "own" ? (mint.trim() ? tokenPairingError(mint) : "Paste your Pump.fun coin address, or pick another option.") : "");
  const validateTeam = () => {
    if (!makers.includes("open_roles")) return "";
    if (!roles.some((r) => r.name.trim())) return "Add at least one open role, or remove that option.";
    const missing = firstRoleMissingDetails(roles);
    return missing ? `Add responsibilities, requirements and location for "${missing.name?.trim()}". Only timing is optional.` : "";
  };
  const goNext = () => {
    const values: Record<string, string> = { title, name, making, description: desc, audience, location: city, category, cover: cover || "" };
    const message = stepKey === "idea" ? (IDEA_SCREENS[ideaIndex] || []).map((q) => validateIdeaQuestion(q, values[q] || "")).find(Boolean) || "" : stepKey === "scope" ? validateScope() : stepKey === "team" ? validateTeam() : "";
    if (message) { setErr(message); return; }
    setErr("");
    if (stepKey === "idea" && ideaIndex < IDEA_SCREENS.length - 1) { setIdeaIndex(ideaIndex + 1); return; }
    const next = flow[step];
    if (next) { setStepKey(next); save(flow.indexOf(next) + 1); }
  };
  const back = () => {
    setErr("");
    if (stepKey === "idea" && ideaIndex > 0) { setIdeaIndex(ideaIndex - 1); return; }
    const previous = flow[step - 2]; if (previous) { setStepKey(previous); if (previous === "idea") setIdeaIndex(IDEA_SCREENS.length - 1); }
  };

  const SplitMini = () => (
    <div className="rz-split" style={{ marginBottom: ".9rem" }}>
      <div className="rz-bar"><i className="rz-c-a" style={{ width: `${artistPct}%` }} />{isBrand && <i className="rz-c-t" style={{ width: `${talentPct}%` }} />}<i className="rz-c-f" style={{ width: `${feePct}%` }} /><i className="rz-c-c" style={{ width: `${causePct}%` }} /></div>
      {([["rz-c-a", leadLabel, artistPct], ...(isBrand ? [["rz-c-t", "Talent", talentPct]] : []), ["rz-c-f", FEE_LABEL, feePct], ["rz-c-c", causeName.trim() ? `${causeLabel} · ${causeName.trim()}` : causeLabel, causePct]] as [string, string, number][]).map(([c, l, p]) => (
        <div className="rz-split-row" key={c}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{p}%</span><span className="rz-amt">{needQuote ? "—" : money(budgetCents * p / 100)}</span></div>
      ))}
    </div>
  );

  const stepLabels = ["Goal", "Basics", ...flow.slice(1).map((k) => STEP_SHORT[k])];
  const curIdx = stepKey === "idea" ? ideaIndex : flow.indexOf(stepKey) + 1;
  const jumpTo = (i: number) => {
    if (i > curIdx) return; setErr("");
    if (i <= 1) { setStepKey("idea"); setIdeaIndex(i); } else setStepKey(flow[i - 1]);
  };
  const timelineText = timelineMode === "date" ? deadline : timeline;
  const makerNames = [...makers.map((id) => MAKERS.find((m) => m.id === id)?.title).filter(Boolean), ...people.map((p) => p.display_name)] as string[];
  const namedRoles = makers.includes("open_roles") ? roles.filter((x) => x.name.trim()) : [];
  const preview = (
    <aside className={`rzm-preview${stepKey === "review" ? " show" : ""}`} aria-label="Project page preview">
      <div className="rzm-pv-label">Live preview · your project page</div>
      <div className="rzm-pv-card">
        <div className="rzm-pv-cover">{coverPreview ? <img src={coverPreview} alt="" /> : <span>{(title.trim() || "R").slice(0, 1).toUpperCase()}</span>}
          {(coin || coinChoice === "rhozeland") && <em className="rzm-pv-coin"><Coins size={11} /> {coin ? (coin.ticker ? `$${coin.ticker}` : "Coin") : "Coin soon"}</em>}
        </div>
        <div className="rzm-pv-body">
          {category && <small className="rzm-pv-cat">{category}</small>}
          <h3>{title.trim() || "Your project name"}</h3>
          <p className="rzm-pv-by">by {name.trim() || "you"}</p>
          <p className="rzm-pv-desc">{desc.trim() || "Your description shows here."}</p>
          <dl className="rzm-pv-stats">
            <div><dt>Budget</dt><dd>{needQuote ? "Estimate" : budgetCents ? money(budgetCents) : "Not set"}</dd></div>
            <div><dt>Timeline</dt><dd>{timelineText || "Not set"}</dd></div>
            <div><dt>Team</dt><dd>{makerNames.length ? makerNames.length : "Just you"}</dd></div>
          </dl>
          {namedRoles.length > 0 && <div className="rzm-pv-roles"><b>Hiring</b>{namedRoles.slice(0, 4).map((r) => <span key={r.id}>{r.name}</span>)}</div>}
        </div>
      </div>
      <p className="rzm-pv-note">Private until you publish.</p>
    </aside>
  );

  return (
    <Shell className="rz-create-simple">
      <div className="rz-create-panel">
      <div className="rz-wizard-toolbar">
        <ExistingProjects expandedBar />
        <div className="rz-wizard-toolbar-actions">
          <Button variant="outline" className="rz-btn" onClick={saveToProfile} disabled={saving || savingToProfile}>{saving || savingToProfile ? "Saving…" : "Save draft"}</Button>
        </div>
      </div>
      <div className="rzm-layout">
      <div className="rz-card rz-wizard rzm-main">
        <ol className="rzm-steps" aria-label="Project creation progress">
          {stepLabels.map((l, i) => (
            <li key={l} className={i === curIdx ? "on" : i < curIdx ? "done" : ""}>
              <button type="button" disabled={i > curIdx} aria-current={i === curIdx ? "step" : undefined} onClick={() => jumpTo(i)}>
                <span className="rzm-dot">{i < curIdx ? <Check size={11} /> : i + 1}</span><span className="rzm-lbl">{l}</span>
              </button>
            </li>
          ))}
        </ol>

        {stepKey === "idea" && ideaIndex === 0 && <>
          <div className="rzm-head"><h1>What brings you here?</h1><p>Pick one and we'll only ask what matters. You can change it later.</p></div>
          <div className="rzm-goals">
            {PROJECT_GOALS.map((g) => { const Icon = GOAL_ICONS[g.id]; return (
              <button key={g.id} type="button" aria-pressed={goal === g.id} className={`rzm-goal ${goal === g.id ? "on" : ""}`} onClick={() => pickGoal(g.id)}>
                <span className="rzm-goal-ico"><Icon size={18} /></span>
                <span className="rzm-goal-txt"><b>{g.title}</b><small>{g.desc}</small></span>
                <ChevronRight size={16} className="rzm-goal-go" />
              </button>
            ); })}
          </div>
          <div className="rzm-skip"><button type="button" onClick={() => setIdeaIndex(1)}>Just start a project →</button></div>
        </>}

        {stepKey === "idea" && ideaIndex === 1 && <>
          <div className="rzm-head"><h1>The basics</h1><p>This is what people see on your project page.</p></div>
          <div className="rzm-basics">
            <div
              role="button" tabIndex={0} aria-label="Upload or drop cover art"
              className={`rzm-cover${coverDrag ? " drag" : ""}${coverPreview ? " has" : ""}`}
              onClick={() => { if (!coverBusy) coverInput.current?.click(); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !coverBusy) { e.preventDefault(); coverInput.current?.click(); } }}
              onDragEnter={(e) => { e.preventDefault(); if (!coverBusy) setCoverDrag(true); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!coverBusy) setCoverDrag(true); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCoverDrag(false); }}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setCoverDrag(false); if (!coverBusy) void dropCover(e.dataTransfer); }}
            >
              {coverPreview ? <img src={coverPreview} alt="Cover art preview" /> : <span><ImagePlus size={22} /><b>{coverBusy ? "Loading…" : coverDrag ? "Drop it here" : "Add a cover"}</b><small>Drag a photo or click · optional</small></span>}
            </div>
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={coverBusy} onChange={(e) => { selectCover(e.target.files?.[0]); e.target.value = ""; }} />
            {cover && <div className="rzm-cover-tools"><button type="button" disabled={coverBusy} onClick={adjustCover}>Adjust</button><button type="button" disabled={coverBusy} onClick={() => coverInput.current?.click()}>Replace</button><button type="button" disabled={coverBusy} onClick={() => { setCover(null); setCoverSource(null); }}>Remove</button></div>}
            {coverFile && <CoverEditor file={coverFile} busy={coverBusy} onCancel={() => setCoverFile(null)} onApply={uploadCover} />}

            <input id="project-name" aria-label="Project name" className="rzm-title" value={title} maxLength={120} placeholder="Project name" onChange={(e) => setTitle(e.target.value)} />
            <div className="rzm-row">
              <label className="rzm-field"><span>By</span><input id="creator-name" className="rz-in" value={name} maxLength={100} placeholder="Your name or alias" onChange={(e) => setName(e.target.value)} /></label>
            </div>
            <label className="rzm-field">
              <span>About the project</span>
              <textarea id="project-description" className="rz-in" value={desc} maxLength={600} rows={4} placeholder="What is it, and what's the story behind it?" onChange={(e) => setDesc(e.target.value)} />
              <span className="rzm-ai">
                <button type="button" onClick={generateDesc} disabled={descBusy}><Sparkles size={13} /> {descBusy ? "Writing…" : desc.trim() ? "Polish with AI" : "Write it with AI"}</button>
                <small>{desc.length}/600</small>
              </span>
              {descErr && <p className="rz-brief-ai-err" role="alert">{descErr}</p>}
            </label>
            <div className="rzm-field"><span>Category</span>
              <div className="rzm-chips">{CATEGORIES.map((c) => <button key={c} type="button" aria-pressed={category === c} className={category === c ? "on" : ""} onClick={() => setCategory((x) => (x === c ? "" : c))}>{c}</button>)}</div>
            </div>
            <details className="rzm-more" open={!!(audience || city || country)}>
              <summary>More details <small>optional</small></summary>
              <label className="rzm-field"><span>Who is it for?</span><input id="project-audience" className="rz-in" value={audience} maxLength={300} placeholder="Fans of R&B in Toronto" onChange={(e) => setAudience(e.target.value)} /></label>
              <div className="rzm-field"><span>Where is it based?</span><LocationFields city={city} country={country} onCity={setCity} onCountry={setCountry} /></div>
            </details>
          </div>
          <div className="rzm-actions"><Button variant="outline" className="rz-btn" onClick={back}><ArrowLeft size={14}/>Back</Button><Button variant="outline" className="rz-btn pri" disabled={coverBusy || !!coverFile} onClick={goNext}>Continue <ArrowRight size={14} /></Button></div>
        </>}

        {stepKey === "scope" && <>
          <div className="rz-head"><h1>What's the scope?</h1><p>All optional. Skip anything that doesn't apply.</p></div>
          <div className="rz-scope">
            <section className="rz-scope-row">
              <h3>Budget</h3>
              <div className="rz-scope-inline">
                <div className="rz-money"><span>$</span><input id="project-budget" className="rz-in" aria-label="Budget" disabled={needQuote} inputMode="decimal" value={budget} placeholder={needQuote ? "Estimate needed" : "Amount"} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.,]/g, ""))} /></div>
                <button type="button" className={`rz-chipbtn ${needQuote ? "on" : ""}`} aria-pressed={needQuote} onClick={() => { setNeedQuote(!needQuote); if (!needQuote) setBudget(""); }}>Not sure yet</button>
              </div>
            </section>
            <section className="rz-scope-row">
              <h3>Timeline</h3>
              <div className="rz-timeline-grid">
                {TIMELINES.map((t) => (
                  <button key={t} type="button" aria-pressed={timelineMode === "flexible" && timeline === t} className={`rz-chipbtn ${timelineMode === "flexible" && timeline === t ? "on" : ""}`} onClick={() => { setTimelineMode("flexible"); setTimeline(t); }}>{t}</button>
                ))}
                <button type="button" aria-pressed={timelineMode === "date"} className={`rz-chipbtn ${timelineMode === "date" ? "on" : ""}`} onClick={() => setTimelineMode("date")}>{timelineMode === "date" && deadline ? deadline : "Pick a date"}</button>
              </div>
              {timelineMode === "date" && <Calendar mode="single" selected={deadline ? new Date(`${deadline}T12:00:00`) : undefined} onSelect={(date) => setDeadline(date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}` : "")} />}
            </section>
            <section className="rz-scope-row">
              <h3>Coin</h3>
              <div className="rz-timeline-grid" role="radiogroup" aria-label="Coin">
                {COIN_CHOICES.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={coinChoice === k} className={`rz-chipbtn ${coinChoice === k ? "on" : ""}`} onClick={() => setCoinChoice(k)}>{l}</button>)}
              </div>
              {coinChoice === "rhozeland" && <p className="rz-note">Rhozeland launches it for you, covered by the Rhozeland fee.</p>}
              {coinChoice === "own" && <>
                <div className="rz-scope-inline">
                  <input id="project-contract" className="rz-in" aria-label="Pump.fun coin address" placeholder="Paste Pump.fun address" value={mint} onChange={(e) => { setMint(e.target.value); setTicker(""); setMeta(null); }} />
                  <button type="button" className={`rz-chipbtn ${mint.trim() === RHOZE_MINT ? "on" : ""}`} aria-pressed={mint.trim() === RHOZE_MINT} onClick={() => { setMint(RHOZE_MINT); setTicker("RHOZE"); setMeta(null); }}>Use $RHOZE</button>
                </div>
                {mintOk && <input id="project-ticker" className="rz-in" aria-label="Ticker" placeholder="Ticker (optional), e.g. RHOZE" maxLength={12} value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />}
                <Popover><PopoverTrigger asChild><button type="button" className="rz-scope-more"><Info size={12} /> What this does</button></PopoverTrigger><PopoverContent>{TOKEN_PAIRING_NOTICE}</PopoverContent></Popover>
              </>}
            </section>
          </div>
          <div className="rz-actions">
            <Button variant="outline" className="rz-btn" onClick={back}><ArrowLeft /> Back</Button>
            <Button variant="outline" className="rz-btn pri" onClick={goNext}>Next <ArrowRight size={14} /></Button>
          </div>
        </>}

        {stepKey === "team" && <>
          <div className="rz-head"><h1>Who's making it?</h1><p>Optional. Add people or skip if it's just you.</p></div>
          <TeamPlanner people={people} onChange={setPeople} />
          <div className="rz-maker-grid">
            {MAKERS.map((m) => (
              <Button variant="outline" key={m.id} type="button" aria-pressed={makers.includes(m.id)} className={`rz-maker-card ${makers.includes(m.id) ? "on" : ""}`} onClick={() => toggleMaker(m.id)}>
                <b>{m.title}</b><span>{m.desc}</span>
              </Button>
            ))}
          </div>
          {makers.includes("rhozeland") && <RhozelandTeam projectTitle={title} />}
          {makers.includes("open_roles") && (
            <div className="rz-inv" style={{ marginTop: ".9rem" }}>
              <div className="rz-roles-h"><span>Role</span><span>People</span><span>Rate</span><span /></div>
              {roles.map((x, i) => (
                <div className="rz-role-editor" key={x.id}>
                <div className="rz-role">
                  <input className="rz-in" value={x.name} maxLength={80} aria-label={`Role ${i + 1} name`} placeholder="e.g. Model" onChange={(e) => updateRole(x.id, { name: e.target.value })} />
                  <input className="rz-in" inputMode="numeric" value={x.count} maxLength={3} aria-label={`Role ${i + 1} people needed`} placeholder="1" onChange={(e) => updateRole(x.id, { count: e.target.value.replace(/[^0-9]/g, "") })} />
                  <input className="rz-in" value={x.rate} maxLength={60} aria-label={`Role ${i + 1} rate`} placeholder="e.g. $300/day" onChange={(e) => updateRole(x.id, { rate: e.target.value })} />
                  <Button variant="outline" className="rz-ico" aria-label="Remove role" onClick={() => setRoles((rs) => rs.filter((y) => y.id !== x.id))}><Trash2 size={13} /></Button>
                </div>
                <div className="rz-role-details-editor">
                  <div className="rz-role-details-caption">Role details <span>(timing optional)</span></div>
                  <div className="rz-role-details-fields">{ROLE_DETAIL_FIELDS.map(({ key, label, placeholder, multiline, optional }) => <label key={key}><span>{label}{optional && <em>(optional)</em>}</span>{multiline ? <textarea className="rz-in" aria-label={`Role ${i + 1} ${label.toLowerCase()}`} rows={3} maxLength={2000} placeholder={placeholder} value={x[key] || ''} onChange={e => updateRole(x.id, { [key]: e.target.value })}/> : <input className="rz-in" aria-label={`Role ${i + 1} ${label.toLowerCase()}`} maxLength={300} placeholder={placeholder} value={x[key] || ''} onChange={e => updateRole(x.id, { [key]: e.target.value })}/>}</label>)}</div>
                </div>
                </div>
              ))}


              {!roles.length && <div className="rz-note" style={{ padding: ".8rem" }}>No roles yet. Add one below.</div>}
              <div className="rz-actions" style={{ marginTop: ".6rem" }}>
                <Button variant="outline" className="rz-btn" disabled={roles.length >= 20} onClick={() => setRoles((rs) => [...rs, { id: uid(), name: "", count: "1", rate: "" }])}><Plus size={13} /> Add role</Button>
              </div>
            </div>
          )}
          <div className="rz-actions" style={{ marginTop: ".9rem" }}>
            <Button variant="outline" className="rz-btn" onClick={back}><ArrowLeft /> Back</Button>
            <Button variant="outline" className="rz-btn pri" onClick={goNext}>{!makers.length && !people.length ? "Skip" : "Next"}{nextLabel ? `: ${nextLabel}` : ""} <ArrowRight size={14} /></Button>
          </div>
        </>}

        {stepKey === "call" && <>
          <BookCallStep choice={callChoice} onChoice={setCallChoice} booked={null} />
          <div className="rz-actions">
            <Button variant="outline" className="rz-btn" onClick={back}><ArrowLeft /> Back</Button>
            <Button variant="outline" className="rz-btn pri" onClick={goNext}>{callChoice ? "Next: Review" : "Skip for now"} <ArrowRight size={14} /></Button>
          </div>
        </>}

        {stepKey === "review" && (
          <>
            <div className="rz-head">
              <h1>Looks good?</h1>
              <p>Your project page is on the right. Tap any step above to change something.</p>
            </div>
            <div className="rz-review-section">The idea</div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Project</span><b style={{ wordBreak: "break-word" }}>{title}</b></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Creator</span><span>{name}</span></div>
              {category && <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Category</span><span>{category}</span></div>}
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Cover</span>{coverPreview ? <img src={coverPreview} alt="Cover art" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} /> : <span className="rz-opt">No cover yet</span>}</div>
            </div>
            <div className="rz-review-section">Scope</div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Budget</span><b>{needQuote ? "Estimate needed" : budgetCents ? money(budgetCents) : "Not set yet"}</b></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Timeline</span><span>{timelineMode === "date" ? (deadline || "Not set yet") : timeline || "Not set yet"}</span></div>
              {coinChoice === "rhozeland" && <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Coin</span><span>Coin launch requested</span></div>}
              {coin && <div className="rz-split-row"><span>Paired token</span><span className="break-all">{coin.ticker ? `$${coin.ticker} · ` : ""}{coin.mint}</span></div>}
            </div>

            <div className="rz-review-section">Who's making it</div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Makers</span><span>{[...makers.map((id) => MAKERS.find((m) => m.id === id)?.title).filter(Boolean), ...people.map((p) => p.display_name)].join(", ") || "You"}</span></div>
            </div>
            {makers.includes("open_roles") && roles.filter((x) => x.name.trim()).length > 0 && (
              <>
                <div className="rz-review-section">Open roles</div>
                <div className="rz-inv" style={{ marginBottom: ".9rem" }}>
                  {roles.filter((x) => x.name.trim()).map((x) => (
                    <div key={x.id} className="rz-row" style={{ gridTemplateColumns: "1fr auto auto", fontSize: ".78rem", gap: ".8rem" }}>
                      <div className="min-w-0"><b>{x.name}</b><RoleDetails role={x}/></div>
                      <span className="rz-opt">{Math.max(1, parseInt(x.count) || 1)} needed</span>
                      <span className="rz-amt">{x.rate || "Rate open"}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="rz-review-section">Call</div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Call</span><span>{callChoice ? `${fmtSlot(new Date(callChoice.slot))}${callChoice.pay ? " · paid with 1 credit" : ""}` : "No call booked"}</span></div>
            </div>
            {genBusy && <GenProgress title={title} />}
            <div className="rz-actions">
              <Button variant="outline" className="rz-btn" onClick={back}><ArrowLeft /> Back</Button>
              <Button variant="outline" className="rz-btn pri" disabled={publishing || genBusy} onClick={publish}>{publishing ? "Opening…" : callChoice ? "Create project & book call" : "Create private project"}</Button>
            </div>
            <div style={{ textAlign: "center", marginTop: ".6rem" }}><Button variant="outline" className="rz-textlink" disabled={saving || savingToProfile} onClick={saveToProfile}>{saving || savingToProfile ? "Saving…" : "Save as draft"}</Button></div>
            <p className="rz-note">Private workspace · publish to Discover later, only when you choose.</p>
          </>
        )}

        {err && <div className="rz-err">{err}</div>}
        {authFor && <AuthModal action={localStorage.getItem(PENDING_DRAFT_KEY) ? " and save draft" : " and create project"} intro={localStorage.getItem(PENDING_DRAFT_KEY) ? "Create an account or log in to keep this private draft on your profile." : callChoice ? "Create an account to confirm your call. We'll pick up right where you left off." : "Create an account to manage your private project."} onClose={() => { setAuthFor(null); localStorage.removeItem(PENDING_KEY); }} onDone={() => setAuthFor(null)}
          redirectTo={`${location.origin}/create.html?draft=${authFor}`} />}
        {savedAt && <div className="rz-note rz-saved">Project saved {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>}
      </div>
      {preview}
      </div>
      </div>
    </Shell>
  );
}
