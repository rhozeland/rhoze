import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, RefreshCw, Sparkles, Check, ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, Milestone, money, uid } from "./shared";
import AuthModal from "./AuthModal";
import CoverEditor from "./CoverEditor";
import { LocationFields } from "./ProfileExtras";
import { Button } from "@/components/ui/button";
import "./create-flow.css";
import ExistingProjects from "./ExistingProjects";
import TeamPlanner from "./TeamPlanner";
import { saveTeam } from "./team-storage";
import { IDEA_QUESTIONS, FLEXIBLE_TIMELINES, scopeError, validateIdeaQuestion, type TeamPerson } from "./project-flow";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

const TOKEN_KEY = "rz_release_token";
const DRAFT_KEY = "rz_release_draft";
const PENDING_KEY = "rz_pending_workspace";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function getToken() {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) { t = uid() + uid(); localStorage.setItem(TOKEN_KEY, t); }
  return t;
}

type Role = { id: string; name: string; count: string; rate: string };
type PType = "artist" | "brand";

// The wizard is now a single merged 4-step flow shared by both project types.
type StepKey = "idea" | "scope" | "team" | "review";
const FLOW: StepKey[] = ["idea", "scope", "team", "review"];
const STEP_LABEL: Record<StepKey, string> = { idea: "The idea", scope: "Scope", team: "Who's making it", review: "Review" };

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
  const [originalAnswers, setOriginalAnswers] = useState<Record<string, unknown>>({});
  const [people, setPeople] = useState<TeamPerson[]>([]);
  const [timelineMode, setTimelineMode] = useState("flexible");
  const [deadline, setDeadline] = useState("");
  const [stepKey, setStepKey] = useState<StepKey>("idea");
  const [talentPct, setTalentPct] = useState(15);
  const [roles, setRoles] = useState<Role[]>([]);
  const step = Math.max(1, FLOW.indexOf(stepKey) + 1);
  const isBrand = ptype === "brand";
  const leadLabel = isBrand ? "Brand" : "Artist";
  const causeLabel = isBrand ? "Project" : "Cause";
  const tPct = isBrand ? talentPct : 0;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
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

  const budgetCents = Math.max(0, Math.round((parseFloat(budget.replace(/[^0-9.]/g, "")) || 0) * 100));
  const artistPct = Math.max(0, 100 - feePct - causePct - tPct);
  const mintOk = MINT_RE.test(mint.trim());
  const tick = ticker.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
  const coin: Coin = mintOk && tick ? { mint: mint.trim(), ticker: tick, name: meta?.mint === mint.trim() ? meta.name : tick, image: meta?.mint === mint.trim() ? meta.image : null } : null;
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
    const fromParam = !!params.get("draft");
    if (!id || params.get("new") === "1") { applyBooking(); return; }
    (async () => {
      const { data } = await (supabase.rpc as any)("release_get_draft", { p_token: token, p_id: id });
      const r = Array.isArray(data) ? data[0] : null;
      if (!r || (!fromParam && r.status !== "draft")) { localStorage.removeItem(DRAFT_KEY); applyBooking(); return; }
      setDraftId(r.id);
      setOriginalAnswers(r.answers || {});
      setIdeaIndex(Number(r.answers?.idea_question) || 0);
      setTimelineMode(r.answers?.timeline_mode || "flexible");
      setDeadline(r.answers?.deadline || "");
      const { data: team } = await supabase.from("release_team_members").select("creator_id,display_name,email").eq("release_id", r.id);
      setPeople(team || []);
      const lt: PType = r.answers?.project_type === "brand" ? "brand" : "artist";
      setPtype(lt);
      { setTalentPct(Number(r.answers?.talent_pct ?? 15)); setRoles((r.answers?.roles || []).map((x: any) => ({ id: uid(), name: x.name || "", count: String(x.count ?? ""), rate: x.rate || "" }))); }

      // Resolve the step to reopen on: new wizard_step keys win, otherwise map
      // the old key (or old numeric current_step) onto the new 4-step flow.
      const restored = r.answers?.wizard_step as string | undefined;
      let resolved: StepKey = "idea";
      if (restored && (FLOW as string[]).includes(restored)) resolved = restored as StepKey;
      else if (restored && OLD_TO_NEW[restored]) resolved = OLD_TO_NEW[restored];
      else { const oldKey = OLD_LEGACY_ORDER[(r.current_step || 1) - 1]; resolved = OLD_TO_NEW[oldKey] || "idea"; }
      setStepKey(fromParam ? "idea" : resolved);

      setName(r.creator_name || booking.name || ""); setEmail(r.creator_email || booking.email || "");
      setTitle(r.title || ""); setMaking(r.answers?.making || ""); setDesc(r.answers?.description || ""); setAudience(r.answers?.audience || "");
      setCategory(r.answers?.category || "");
      setCity(r.answers?.city || ""); setCountry(r.answers?.country || "");
      setBudget(r.budget_cents ? String(r.budget_cents / 100) : "");
      setNeedQuote(!!r.answers?.need_quote);
      setTimeline(r.answers?.timeline || "");
      setMakers(Array.isArray(r.answers?.makers) ? r.answers.makers : []);
      setFeePct(Number(r.fee_pct)); setCausePct(Number(r.cause_pct)); setCauseName(r.cause_name || "");
      setRows((r.milestones || []).map((m: any) => ({ id: uid(), ...m })));
      if (r.coin_mint) { setMint(r.coin_mint); setTicker(r.coin_ticker || ""); setMeta({ mint: r.coin_mint, name: r.coin_name, image: r.coin_image }); }
      setWallet(r.payout_wallet || "");
      setCover(r.cover_url || null);
    })();
  }, [token]);

  const payload = (s = step) => ({
    title: title.trim(), creator_name: name.trim(), creator_email: email.trim(), booking_id: bookingId,
    answers: {
      ...originalAnswers, idea_question: ideaIndex, timeline_mode: timelineMode, deadline,
      wizard_step: FLOW[s - 1] || stepKey, making: making.trim(), description: desc.trim(), audience: audience.trim(),
      category, project_type: ptype, need_quote: needQuote, timeline, makers, city: city.trim(), country,
      ...{ talent_pct: talentPct, roles: roles.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), count: Math.max(1, parseInt(x.count) || 1), rate: x.rate.trim() })) },
    },
    budget_cents: budgetCents, artist_pct: artistPct + tPct, fee_pct: feePct, cause_pct: causePct, cause_name: causeName.trim(),
    milestones: rows.map(({ title, deliverable, amount_cents }) => ({ title: title.trim(), deliverable: deliverable.trim(), amount_cents })),
    coin_mint: coin?.mint ?? "", coin_ticker: coin?.ticker ?? "", coin_name: coin?.name ?? "", coin_image: coin?.image ?? "",
    payout_wallet: wallet.trim(), cover_url: cover ?? "", current_step: s,
  });

  const save = async (s = step): Promise<string | null> => {
    setSaving(true); setErr("");
    const { data, error } = await (supabase.rpc as any)("release_save", { p_token: token, p_id: draftId, p_data: payload(s) });
    setSaving(false);
    if (error) { setErr("We couldn't save your draft. Check your connection and try again."); return null; }
    setDraftId(data); localStorage.setItem(DRAFT_KEY, data);
    const u = new URL(location.href); u.searchParams.set("draft", data); u.searchParams.delete("new"); history.replaceState(null, "", u);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) { try { await saveTeam(data, people); } catch { setErr("Project saved, but your team shortlist couldn't be saved. Try again."); return null; } }
    setSavedAt(new Date());
    return data as string;
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
  const toggleMaker = (id: string) => setMakers((ms) => (ms.includes(id) ? ms.filter((x) => x !== id) : [...ms, id]));

  // Coin lookup kept for backward compatibility (field no longer shown in the
  // wizard — attach/change happens on the project page after publish).
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
        if (data?.ticker) { setMeta({ mint: m, name: data.name, image: data.image }); setTicker((x) => x || data.ticker); }
      } catch { /* manual ticker still works */ }
    }, 400);
    return () => clearTimeout(t);
  }, [mint]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishPublish = async (id: string) => {
    setPublishing(true); setErr("");
    const { error } = await supabase.rpc("release_claim", { p_token: token });
    if (error) { setPublishing(false); setErr("Couldn't open your workspace. Please try again."); return; }
    try { await saveTeam(id, people); } catch { setPublishing(false); setErr("Couldn't save your team shortlist. Please try again."); return; }
    localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(PENDING_KEY);
    location.href = `/workspace/${id}`;
  };
  const publish = async () => {
    const id = await save(FLOW.length);
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { localStorage.setItem(PENDING_KEY, id); setAuthFor(id); return; }
    await finishPublish(id);
  };
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const pending = localStorage.getItem(PENDING_KEY);
        if (pending) setTimeout(() => { setAuthFor(null); finishPublish(pending); }, 0);
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

  const nextLabel = FLOW[step] ? STEP_LABEL[FLOW[step]] : null;

  const validateIdea = () => {
    if (!name.trim()) return "Add your name.";
    if (!title.trim()) return "Give your project a name.";
    if (!making.trim()) return "Tell us what you're making.";
    if (!desc.trim()) return "Add a short description of your project.";
    return "";
  };
  const validateScope = () => scopeError(budgetCents, needQuote, timelineMode, timeline, deadline);
  const validateTeam = () => makers.includes("open_roles") && !roles.some((r) => r.name.trim()) ? "Add at least one open role, or remove that option." : "";
  const goNext = () => {
    const values: Record<string, string> = { title, name, making, description: desc, audience, location: city, category, cover: cover || "" };
    const question = IDEA_QUESTIONS[ideaIndex];
    const message = stepKey === "idea" ? validateIdeaQuestion(question || "", values[question] || "") : stepKey === "scope" ? validateScope() : stepKey === "team" ? validateTeam() : "";
    if (message) { setErr(message); return; }
    setErr("");
    if (stepKey === "idea" && ideaIndex < IDEA_QUESTIONS.length - 1) { setIdeaIndex(ideaIndex + 1); return; }
    const next = FLOW[step];
    if (next) { setStepKey(next); save(FLOW.indexOf(next) + 1); }
  };
  const back = () => {
    setErr("");
    if (stepKey === "idea" && ideaIndex > 0) { setIdeaIndex(ideaIndex - 1); return; }
    const previous = FLOW[step - 2]; if (previous) { setStepKey(previous); if (previous === "idea") setIdeaIndex(IDEA_QUESTIONS.length - 1); }
  };

  const SplitMini = () => (
    <div className="rz-split" style={{ marginBottom: ".9rem" }}>
      <div className="rz-bar"><i className="rz-c-a" style={{ width: `${artistPct}%` }} />{isBrand && <i className="rz-c-t" style={{ width: `${talentPct}%` }} />}<i className="rz-c-f" style={{ width: `${feePct}%` }} /><i className="rz-c-c" style={{ width: `${causePct}%` }} /></div>
      {([["rz-c-a", leadLabel, artistPct], ...(isBrand ? [["rz-c-t", "Talent", talentPct]] : []), ["rz-c-f", "Rhozeland fee", feePct], ["rz-c-c", causeName.trim() ? `${causeLabel} · ${causeName.trim()}` : causeLabel, causePct]] as [string, string, number][]).map(([c, l, p]) => (
        <div className="rz-split-row" key={c}><span className={`rz-sw ${c}`} /><span>{l}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{p}%</span><span className="rz-amt">{needQuote ? "—" : money(budgetCents * p / 100)}</span></div>
      ))}
    </div>
  );

  return (
    <Shell className="rz-create-simple">
      <ExistingProjects />
      <div className="rz-wizard-toolbar">
        <Button variant="ghost" className="rz-wizard-back" onClick={(step > 1 || ideaIndex > 0) ? back : () => { location.href = "/"; }}><ArrowLeft size={15} /> Back</Button>
        <div className="rz-wizard-toolbar-actions">
          <Button variant="outline" className="rz-btn" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save draft"}</Button>
          <Button variant="outline" className="rz-btn" asChild><a href="/">Cancel</a></Button>
        </div>
      </div>
      <div className={`rz-card rz-wizard ${stepKey === "team" || stepKey === "review" ? "rz-card-wide" : ""}`}>
        <FileText className="rz-wizard-mark" size={30} aria-hidden="true" />
        <div className="rz-wizard-progress">
          <div className="rz-wizard-count"><span>Step {step} of {FLOW.length}</span><span>{STEP_LABEL[stepKey]}</span></div>
          <progress aria-label="Project creation progress" max={FLOW.length} value={step} />
          <p>{nextLabel ? `Next: ${nextLabel}` : "Ready to create"}</p>
        </div>

        {stepKey === "idea" && <>
          <div className="rz-head"><h1>{["What's your project called?", "What's your name?", "What are you making?", "A brief description", "Who is it for?", "Where is it based?", "Choose a category", "Add a cover"][ideaIndex]}</h1><p>Question {ideaIndex + 1} of {IDEA_QUESTIONS.length}</p></div>
          <div className={`rz-wizard-fields rz-idea-question rz-idea-q-${ideaIndex}`}>
            <div className="rz-field"><label htmlFor="project-name">Project name</label><input id="project-name" className="rz-in" value={title} maxLength={120} placeholder="e.g. Summer EP launch" onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="rz-field"><label htmlFor="creator-name">Your name</label><input id="creator-name" className="rz-in" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></div>
            <div className="rz-field">
              <label htmlFor="project-brief">What are you making?</label>
              <textarea id="project-brief" className="rz-in rz-wizard-textarea" value={making} maxLength={600} placeholder="A 4-track EP with a music video and cover art…" onChange={(e) => setMaking(e.target.value)} />
              <div className="rz-brief-ai">
                <Button type="button" variant="outline" className="rz-btn" onClick={generateBrief} disabled={briefBusy}>
                  <Sparkles size={14} aria-hidden="true" /> {briefBusy ? "Writing your brief…" : making.trim() ? "Improve with AI" : "Generate with AI"}
                </Button>
                {briefErr && <p className="rz-brief-ai-err" role="alert">{briefErr}</p>}
              </div>
            </div>
            <div className="rz-field">
              <label htmlFor="project-description">Brief description</label>
              <textarea id="project-description" className="rz-in" value={desc} maxLength={600} rows={4} placeholder="The story behind your project and what you'll release." onChange={(e) => setDesc(e.target.value)} />
              <div className="rz-brief-ai">
                <Button type="button" variant="outline" className="rz-btn" onClick={generateDesc} disabled={descBusy}>
                  <Sparkles size={14} aria-hidden="true" /> {descBusy ? "Writing your description…" : desc.trim() ? "Improve with AI" : "Generate with AI"}
                </Button>
                {descErr && <p className="rz-brief-ai-err" role="alert">{descErr}</p>}
              </div>
            </div>
            <div className="rz-field"><label htmlFor="project-audience">Who is it for? <span className="rz-opt">(optional)</span></label><input id="project-audience" className="rz-in" value={audience} maxLength={300} placeholder="Fans of R&B in Toronto" onChange={(e) => setAudience(e.target.value)} /></div>
            <div className="rz-field rz-full">
              <label>Where is this project based? <span className="rz-opt">(optional)</span></label>
              <LocationFields city={city} country={country} onCity={setCity} onCountry={setCountry} />
            </div>
            <div className="rz-field">
              <label>Category</label>
              <div className="rz-category-grid">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" className={`rz-chipbtn ${category === c ? "on" : ""}`} onClick={() => setCategory((x) => (x === c ? "" : c))}>{c}</button>
                ))}
              </div>
            </div>
            <div className="rz-field rz-full">
              <label>Cover art <span className="rz-opt">(optional · JPG, PNG or WebP · drag a photo here)</span></label>
              <div
                role="button" tabIndex={0} aria-label="Upload or drop cover art"
                className={`rz-cover rz-cover-up${coverDrag ? " rz-cover-drag" : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => { if (!coverBusy) coverInput.current?.click(); }}
                onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !coverBusy) { e.preventDefault(); coverInput.current?.click(); } }}
                onDragEnter={(e) => { e.preventDefault(); if (!coverBusy) setCoverDrag(true); }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!coverBusy) setCoverDrag(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setCoverDrag(false); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setCoverDrag(false); if (!coverBusy) void dropCover(e.dataTransfer); }}
              >
                {coverPreview ? <img src={coverPreview} alt="Cover art preview" style={{ pointerEvents: "none" }} /> : <span style={{ pointerEvents: "none" }}>{coverDrag ? "Drop your photo here" : "Drag a photo here or click to upload"}</span>}
              </div>
              <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
                <Button type="button" variant="outline" className="rz-btn" disabled={coverBusy} onClick={() => coverInput.current?.click()}>{coverBusy ? "Loading…" : cover ? "Replace image" : "Upload image"}</Button>
                <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={coverBusy} onChange={(e) => { selectCover(e.target.files?.[0]); e.target.value = ""; }} />
                {cover && <><Button type="button" variant="outline" className="rz-btn" disabled={coverBusy} onClick={adjustCover}>Adjust image</Button><Button type="button" variant="outline" className="rz-btn" disabled={coverBusy} onClick={() => { setCover(null); setCoverSource(null); }}>Remove</Button></>}
              </div>
              {coverFile && <CoverEditor file={coverFile} busy={coverBusy} onCancel={() => setCoverFile(null)} onApply={uploadCover} />}
            </div>
          </div>
          <div className="rz-actions rz-wizard-next"><Button variant="outline" className="rz-btn pri" disabled={coverBusy || !!coverFile} onClick={goNext}>Next <ArrowRight size={14} /></Button></div>
        </>}

        {stepKey === "scope" && <>
          <div className="rz-head"><h1>What's the scope?</h1><p>Set a budget and a timeline, or plan with an estimate.</p></div>
          <div className="rz-wizard-fields">
            <div className="rz-field">
              <label htmlFor="project-budget" className={needQuote ? "rz-opt" : ""}>Budget (CAD)</label>
              <div className="rz-money"><span>$</span><input id="project-budget" className="rz-in" disabled={needQuote} inputMode="decimal" value={budget} placeholder="Enter amount" onChange={(e) => setBudget(e.target.value.replace(/[^0-9.,]/g, ""))} /></div>
              <Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="Budget and taxes"><Info size={14} /></Button></PopoverTrigger><PopoverContent>Applicable taxes may be added to the final estimate. Your planning budget is not a payment.</PopoverContent></Popover>
              <label className="rz-quote-toggle"><input type="checkbox" checked={needQuote} onChange={(e) => { setNeedQuote(e.target.checked); if (e.target.checked) setBudget(""); }} /> Estimate needed (no fixed budget yet)</label>
            </div>
            <div className="rz-field">
              <label>Timeline</label>
              <div className="rz-timeline-grid">{[["flexible", "Flexible timing"], ["date", "Exact date"]].map(([key, label]) => <Button key={key} variant="outline" className={`rz-chipbtn ${timelineMode === key ? "on" : ""}`} aria-pressed={timelineMode === key} onClick={() => setTimelineMode(key)}>{label}</Button>)}</div>
              {timelineMode === "date" && <Calendar mode="single" selected={deadline ? new Date(`${deadline}T12:00:00`) : undefined} onSelect={(date) => setDeadline(date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}` : "")} />}
              {timelineMode === "flexible" && <>
              <div className="rz-timeline-grid">
                {TIMELINES.map((t) => (
                  <button key={t} type="button" className={`rz-chipbtn ${timeline === t ? "on" : ""}`} onClick={() => setTimeline(t)}>{t}</button>
                ))}
              </div></>}
            </div>
          </div>
          <div className="rz-actions">
            <Button variant="outline" className="rz-btn" onClick={back}><ArrowLeft /> Back</Button>
            <Button variant="outline" className="rz-btn pri" onClick={goNext}>Next <ArrowRight size={14} /></Button>
          </div>
        </>}

        {stepKey === "team" && <>
          <div className="rz-head"><h1>Who's making it?</h1><p>Pick one or more. You can change this later.</p></div>
          <TeamPlanner people={people} onChange={setPeople} />
          <div className="rz-maker-grid">
            {MAKERS.map((m) => (
              <Button variant="outline" key={m.id} type="button" className={`rz-maker-card ${makers.includes(m.id) ? "on" : ""}`} onClick={() => toggleMaker(m.id)}>
                <b>{m.title}</b><span>{m.desc}</span>
              </Button>
            ))}
          </div>
          {makers.includes("open_roles") && (
            <div className="rz-inv" style={{ marginTop: ".9rem" }}>
              <div className="rz-roles-h"><span>Role</span><span>People</span><span>Rate</span><span /></div>
              {roles.map((x, i) => (
                <div className="rz-role" key={x.id}>
                  <input className="rz-in" value={x.name} maxLength={80} aria-label={`Role ${i + 1} name`} placeholder="e.g. Model" onChange={(e) => updateRole(x.id, { name: e.target.value })} />
                  <input className="rz-in" inputMode="numeric" value={x.count} maxLength={3} aria-label={`Role ${i + 1} people needed`} placeholder="1" onChange={(e) => updateRole(x.id, { count: e.target.value.replace(/[^0-9]/g, "") })} />
                  <input className="rz-in" value={x.rate} maxLength={60} aria-label={`Role ${i + 1} rate`} placeholder="e.g. $300/day" onChange={(e) => updateRole(x.id, { rate: e.target.value })} />
                  <Button variant="outline" className="rz-ico" aria-label="Remove role" onClick={() => setRoles((rs) => rs.filter((y) => y.id !== x.id))}><Trash2 size={13} /></Button>
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
            <Button variant="outline" className="rz-btn pri" onClick={goNext}>Next: Review <ArrowRight size={14} /></Button>
          </div>
        </>}

        {stepKey === "review" && (
          <>
            <div className="rz-head">
              <h1>Review your project</h1>
              <p>Check everything below. You can go back to edit any step.</p>
            </div>
            <div className="rz-review-section">The idea</div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Project</span><b style={{ wordBreak: "break-word" }}>{title}</b></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Type</span><span>{isBrand ? "Brand project" : "Artist project"}</span></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">{leadLabel}</span><span>{name}</span></div>
              {category && <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Category</span><span>{category}</span></div>}
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Cover</span>{coverPreview ? <img src={coverPreview} alt="Cover art" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} /> : <span className="rz-opt">Gradient placeholder</span>}</div>
            </div>
            <div className="rz-review-section">Scope</div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Budget</span><b>{needQuote ? "Estimate needed" : money(budgetCents)}</b></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Timeline</span><span>{timelineMode === "date" ? deadline : timeline || "—"}</span></div>
            </div>

            <div className="rz-review-section">Who's making it</div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Makers</span><span>{makers.map((id) => MAKERS.find((m) => m.id === id)?.title).filter(Boolean).join(", ") || "—"}</span></div>
            </div>
            {makers.includes("open_roles") && roles.filter((x) => x.name.trim()).length > 0 && (
              <>
                <div className="rz-review-section">Open roles</div>
                <div className="rz-inv" style={{ marginBottom: ".9rem" }}>
                  {roles.filter((x) => x.name.trim()).map((x) => (
                    <div key={x.id} className="rz-row" style={{ gridTemplateColumns: "1fr auto auto", fontSize: ".78rem", gap: ".8rem" }}>
                      <b style={{ minWidth: 0, wordBreak: "break-word" }}>{x.name}</b>
                      <span className="rz-opt">{Math.max(1, parseInt(x.count) || 1)} needed</span>
                      <span className="rz-amt">{x.rate || "Rate open"}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {genBusy && <GenProgress title={title} />}
            <div className="rz-actions">
              <Button variant="outline" className="rz-btn" onClick={back}><ArrowLeft /> Back</Button>
              <Button variant="outline" className="rz-btn pri" disabled={publishing || genBusy} onClick={publish}>{publishing ? "Opening…" : "Create private project"}</Button>
            </div>
            <div style={{ textAlign: "center", marginTop: ".6rem" }}><Button variant="outline" className="rz-textlink" disabled={saving} onClick={() => save(FLOW.length)}>{saving ? "Saving…" : "Save as draft"}</Button></div>
            <p className="rz-note">Private workspace · publish to Discover later, only when you choose.</p>
          </>
        )}

        {err && <div className="rz-err">{err}</div>}
        {authFor && <AuthModal onClose={() => { setAuthFor(null); localStorage.removeItem(PENDING_KEY); }} onDone={() => setAuthFor(null)}
          redirectTo={`${location.origin}/create.html?draft=${authFor}`} />}
        {savedAt && <div className="rz-note rz-saved">Project saved {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>}
      </div>
    </Shell>
  );
}
