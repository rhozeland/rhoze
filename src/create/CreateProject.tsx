import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, RefreshCw, Sparkles, Check, ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Shell, Milestone, money, uid } from "./shared";
import AuthModal from "./AuthModal";
import CoverEditor from "./CoverEditor";
import { Button } from "@/components/ui/button";

const TOKEN_KEY = "rz_release_token";
const DRAFT_KEY = "rz_release_draft";
const PENDING_KEY = "rz_pending_publish";
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function getToken() {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) { t = uid() + uid(); localStorage.setItem(TOKEN_KEY, t); }
  return t;
}

type Role = { id: string; name: string; count: string; rate: string };
type PType = "artist" | "brand";
type StepKey = "type" | "details" | "brief" | "description" | "cover" | "budget" | "split" | "roadmap" | "roles" | "coin" | "publish";
const flowFor = (t: PType | null): StepKey[] => ["type", "details", "brief", "description", "cover", "budget", "split", "roadmap", ...(t === "brand" ? ["roles" as StepKey] : []), "coin", "publish"];
const STEP_LABEL: Record<StepKey, string> = { type: "Project type", details: "Project name", brief: "Your brief", description: "Description", cover: "Cover art", budget: "Budget", split: "Budget split", roadmap: "Roadmap", roles: "Roles", coin: "Coin", publish: "Review & publish" };

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
  const [ptype, setPtype] = useState<PType | null>(null);
  const [stepKey, setStepKey] = useState<StepKey>("type");
  const [talentPct, setTalentPct] = useState(15);
  const [roles, setRoles] = useState<Role[]>([]);
  const flow = flowFor(ptype);
  const step = Math.max(1, flow.indexOf(stepKey) + 1);
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
  const [cover, setCover] = useState<string | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverFile, setCoverFile] = useState<Blob | null>(null);
  const [coverSource, setCoverSource] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [coverDrag, setCoverDrag] = useState(false);

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
      const lt: PType | null = r.answers?.project_type === "brand" ? "brand" : r.answers?.project_type === "artist" ? "artist" : null;
      setPtype(lt);
      if (lt === "brand") { setTalentPct(Number(r.answers?.talent_pct ?? 15)); setRoles((r.answers?.roles || []).map((x: any) => ({ id: uid(), name: x.name || "", count: String(x.count ?? ""), rate: x.rate || "" }))); }
      const legacy: StepKey[] = ["type", "details", "roadmap", ...(lt === "brand" ? ["roles" as StepKey] : []), "coin", "publish"];
      const restored = r.answers?.wizard_step;
      setStepKey(lt ? (flowFor(lt).includes(restored) ? restored : legacy[(r.current_step || 2) - 1] || "details") : "type");
      setName(r.creator_name || booking.name || ""); setEmail(r.creator_email || booking.email || "");
      setTitle(r.title || ""); setMaking(r.answers?.making || ""); setDesc(r.answers?.description || ""); setAudience(r.answers?.audience || "");
      setBudget(r.budget_cents ? String(r.budget_cents / 100) : "");
      setFeePct(Number(r.fee_pct)); setCausePct(Number(r.cause_pct)); setCauseName(r.cause_name || "");
      setRows((r.milestones || []).map((m: any) => ({ id: uid(), ...m })));
      if (r.coin_mint) { setMint(r.coin_mint); setTicker(r.coin_ticker || ""); setMeta({ mint: r.coin_mint, name: r.coin_name, image: r.coin_image }); }
      setWallet(r.payout_wallet || "");
      setCover(r.cover_url || null);
    })();
  }, [token]);

  const payload = (s = step) => ({
    title: title.trim(), creator_name: name.trim(), creator_email: email.trim(), booking_id: bookingId,
    answers: { wizard_step: flow[s - 1] || stepKey, making: making.trim(), description: desc.trim(), audience: audience.trim(), project_type: ptype ?? "artist", ...(isBrand ? { talent_pct: talentPct, roles: roles.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), count: Math.max(1, parseInt(x.count) || 1), rate: x.rate.trim() })) } : {}) },
    budget_cents: budgetCents, artist_pct: artistPct + tPct, fee_pct: feePct, cause_pct: causePct, cause_name: causeName.trim(),
    milestones: rows.map(({ title, deliverable, amount_cents }) => ({ title: title.trim(), deliverable: deliverable.trim(), amount_cents })),
    coin_mint: coin?.mint ?? "", coin_ticker: coin?.ticker ?? "", coin_name: coin?.name ?? "", coin_image: coin?.image ?? "",
    payout_wallet: wallet.trim(), cover_url: cover ?? "", current_step: Math.max(1, ["type", "details", "roadmap", ...(isBrand ? ["roles"] : []), "coin", "publish"].indexOf(["brief", "description", "cover", "budget", "split"].includes(flow[s - 1]) ? "details" : flow[s - 1]) + 1),
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
  };

  const generateBrief = async () => {
    if (briefBusy) return;
    if (!title.trim()) { setBriefErr("Add your project name first (previous step)."); return; }
    setBriefBusy(true); setBriefErr("");
    try {
      const { data, error } = await supabase.functions.invoke("release-brief", {
        body: { title: title.trim(), project_type: ptype ?? "artist", audience: audience.trim(), seed: making.trim() },
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
    if (!title.trim()) { setDescErr("Add your project name first (step 2)."); return; }
    setDescBusy(true); setDescErr("");
    try {
      const seed = [making.trim(), desc.trim()].filter(Boolean).join("\n\n");
      const { data, error } = await supabase.functions.invoke("release-brief", {
        body: { title: title.trim(), project_type: ptype ?? "artist", audience: audience.trim(), seed },
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

  const _unused = () => {
    if (!desc.trim()) return "Add a short description of your project.";
    if (budgetCents < 100) return "Enter a budget.";
    if (feePct + causePct + tPct > 100) return "The split can't exceed 100%.";
    return "";
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
      return;
    }
    setRows(data.milestones.map((m: any) => ({ id: uid(), ...m })));
  };

  const goStep2 = async () => {
    const v = validate1(); if (v) { setErr(v); return; }
    setStepKey("roadmap"); save(flow.indexOf("roadmap") + 1);
    if (!rows.length) generate();
  };

  const validate2 = () => {
    if (!rows.length) return "Add at least one milestone.";
    if (rows.some((r) => !r.title.trim())) return "Every milestone needs a title.";
    return "";
  };

  const goStep3 = () => { const v = validate2(); if (v) { setErr(v); return; } setErr(""); const k: StepKey = isBrand ? "roles" : "coin"; setStepKey(k); save(flow.indexOf(k) + 1); };
  const goCoin = () => {
    setErr(""); setStepKey("coin"); save(flow.indexOf("coin") + 1);
  };
  const chooseType = (t: PType) => {
    if (t !== ptype) {
      if (t === "brand") { setFeePct(10); setCausePct(5); setTalentPct(15); if (!roles.length) setRoles([{ id: uid(), name: "", count: "1", rate: "" }]); }
      else { setFeePct(10); setCausePct(10); }
    }
    setPtype(t); setErr(""); setStepKey("details");
  };
  const updateRole = (id: string, patch: Partial<Role>) => setRoles((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const goStep4 = () => {
    if (mint.trim() && !mintOk) { setErr("That mint address doesn't look right. Solana addresses are 32 to 44 letters and numbers."); return; }
    if (mint.trim() && !tick) { setErr("Add your coin's ticker, like $SUMMER."); return; }
    setErr(""); setStepKey("publish"); save(flow.length);
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

  const skipCoin = () => { setMint(""); setTicker(""); setMeta(null); setCoinErr(""); setErr(""); setStepKey("publish"); save(flow.length); };

  // Publish a saved draft by id (used directly and after sign-in)
  const publishingRef = useRef(false);
  const finishPublish = async (id: string) => {
    if (publishingRef.current) return; publishingRef.current = true;
    setPublishing(true); setErr("");
    await (supabase.rpc as any)("release_claim", { p_token: token });
    const { data, error } = await (supabase.rpc as any)("release_publish", { p_token: token, p_id: id });
    setPublishing(false); publishingRef.current = false;
    if (error) { setErr("We couldn't publish right now. Your project is saved, please try again."); return; }
    localStorage.removeItem(DRAFT_KEY); localStorage.removeItem(PENDING_KEY);
    location.href = `/release/${data}`;
  };

  const publish = async () => {
    if (mint.trim() && !coin) { setErr("Fix the coin details or skip the coin step."); setStepKey("coin"); return; }
    setPublishing(true);
    const id = await save(flow.length);
    setPublishing(false);
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { localStorage.setItem(PENDING_KEY, id); setAuthFor(id); return; }
    finishPublish(id);
  };

  // Resume a publish that was waiting on sign-in (same tab or email confirmation link)
  useEffect(() => {
    const resume = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await (supabase.rpc as any)("release_claim", { p_token: token });
      const pending = localStorage.getItem(PENDING_KEY);
      const auto = new URLSearchParams(location.search).get("autopublish") === "1" ? new URLSearchParams(location.search).get("draft") : null;
      const id = pending || auto;
      if (id) finishPublish(id);
    };
    resume();
    const { data: sub } = supabase.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" && localStorage.getItem(PENDING_KEY)) { setAuthFor(null); setTimeout(resume, 0); } });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
  const goNext = () => {
    const message = stepKey === "details" ? (!name.trim() ? "Add your name." : !title.trim() ? "Give your project a name." : "")
      : stepKey === "brief" && !making.trim() ? "Tell us what you're making."
      : stepKey === "description" && !desc.trim() ? "Add a short description of your project."
      : stepKey === "budget" && budgetCents < 100 ? "Enter a budget."
      : stepKey === "split" && feePct + causePct + tPct > 100 ? "The split can't exceed 100%." : "";
    if (message) { setErr(message); return; }
    if (stepKey === "split") { void goStep2(); return; }
    const next = flow[step];
    if (next) { setErr(""); setStepKey(next); }
  };
  const back = () => { const previous = flow[step - 2]; if (previous) { setErr(""); setStepKey(previous); } };
  const simpleStep = ["details", "brief", "description", "cover", "budget", "split"].includes(stepKey);
  const SplitMini = () => (
    <div className="rz-split" style={{ marginBottom: ".9rem" }}>
      <div className="rz-bar"><i className="rz-c-a" style={{ width: `${artistPct}%` }} />{isBrand && <i className="rz-c-t" style={{ width: `${talentPct}%` }} />}<i className="rz-c-f" style={{ width: `${feePct}%` }} /><i className="rz-c-c" style={{ width: `${causePct}%` }} /></div>
      {([["rz-c-a", leadLabel, artistPct], ...(isBrand ? [["rz-c-t", "Talent", talentPct]] : []), ["rz-c-f", "Rhozeland fee", feePct], ["rz-c-c", causeName.trim() ? `${causeLabel} · ${causeName.trim()}` : causeLabel, causePct]] as [string, string, number][]).map(([c, l, p]) => (
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
    <Shell className="rz-create-simple">
      <div className="rz-wizard-toolbar">
        <Button variant="ghost" className="rz-wizard-back" onClick={step > 1 ? back : () => { location.href = "/"; }}><ArrowLeft size={15} /> Back</Button>
        <div className="rz-wizard-toolbar-actions">
          <Button variant="outline" className="rz-btn" onClick={() => save()} disabled={saving}>{saving ? "Saving…" : "Save draft"}</Button>
          <Button variant="outline" className="rz-btn" asChild><a href="/">Cancel</a></Button>
        </div>
      </div>
      <div className={`rz-card rz-wizard ${stepKey === "roadmap" || stepKey === "publish" ? "rz-card-wide" : ""}`}>
        <FileText className="rz-wizard-mark" size={30} aria-hidden="true" />
        <div className="rz-wizard-progress">
          <div className="rz-wizard-count"><span>Step {step} of {flow.length}</span><span>{STEP_LABEL[stepKey]}</span></div>
          <progress aria-label="Project creation progress" max={flow.length} value={step} />
          <p>{nextLabel ? `Next: ${nextLabel}` : "Ready to publish"}</p>
        </div>

        {stepKey === "type" && (
          <>
            <div className="rz-head">
              <h1>What kind of project is this?</h1>
              <p>Pick one to start. You can change it later.</p>
            </div>
            <div className="rz-type-grid">
              {([["artist", "Artist project", "Music, film, art or a release you're making."], ["brand", "Brand project", "A campaign or shoot where you hire creative talent."]] as const).map(([k, l, d]) => (
                <Button variant="outline" key={k} className={`rz-type ${ptype === k ? "on" : ""}`} onClick={() => chooseType(k)}><b>{l}</b><span>{d}</span></Button>
              ))}
            </div>
          </>
        )}

        {stepKey === "details" && <>
          <div className="rz-head"><h1>What’s your project called?</h1><p>A name for your project and the person behind it.</p></div>
          <div className="rz-wizard-fields">
            <div className="rz-field"><label htmlFor="project-name">Project name</label><input id="project-name" className="rz-in" value={title} maxLength={120} placeholder="e.g. Summer EP launch" onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="rz-field"><label htmlFor="creator-name">Your name</label><input id="creator-name" className="rz-in" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></div>
          </div>
        </>}
        {stepKey === "brief" && <>
          <div className="rz-head"><h1>What are you making?</h1><p>Include deliverables, your preferred style, and references.</p></div>
          <div className="rz-field"><label className="sr-only" htmlFor="project-brief">Project brief</label><textarea id="project-brief" className="rz-in rz-wizard-textarea" value={making} maxLength={600} placeholder="A 4-track EP with a music video and cover art…" onChange={(e) => setMaking(e.target.value)} /></div>
          <div className="rz-brief-ai">
            <Button type="button" variant="outline" className="rz-btn" onClick={generateBrief} disabled={briefBusy}>
              <Sparkles size={14} aria-hidden="true" /> {briefBusy ? "Writing your brief…" : making.trim() ? "Improve with AI" : "Generate with AI"}
            </Button>
            {briefErr && <p className="rz-brief-ai-err" role="alert">{briefErr}</p>}
          </div>
        </>}
        {stepKey === "description" && <>
          <div className="rz-head"><h1>Introduce your project</h1><p>A short description for your public project page.</p></div>
          <div className="rz-wizard-fields">
            <div className="rz-field"><label htmlFor="project-description">Brief description</label><textarea id="project-description" className="rz-in" value={desc} maxLength={600} rows={4} placeholder="The story behind your project and what you’ll release." onChange={(e) => setDesc(e.target.value)} /></div>
            <div className="rz-field"><label htmlFor="project-audience">Who is it for? <span className="rz-opt">(optional)</span></label><input id="project-audience" className="rz-in" value={audience} maxLength={300} placeholder="Fans of R&B in Toronto" onChange={(e) => setAudience(e.target.value)} /></div>
          </div>
        </>}
        {stepKey === "cover" && <>
          <div className="rz-head"><h1>Add your cover art</h1><p>Choose an image for your project, or add one later.</p></div>
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
        </>}
        {stepKey === "budget" && <>
          <div className="rz-head"><h1>What’s your project budget?</h1><p>Set the total amount in CAD.</p></div>
          <div className="rz-field"><label htmlFor="project-budget" className="sr-only">Budget (CAD)</label><div className="rz-money"><span>$</span><input id="project-budget" className="rz-in" inputMode="decimal" value={budget} placeholder="Enter amount" onChange={(e) => setBudget(e.target.value.replace(/[^0-9.,]/g, ""))} /></div></div>
        </>}
        {stepKey === "split" && <>
          <div className="rz-head"><h1>How is your budget shared?</h1><p>Keep the suggested split or adjust the percentages.</p></div>
              <div className="rz-split rz-full">
                <div style={{ fontSize: ".72rem", fontWeight: 600 }}>Where the money goes</div>
                <div className="rz-bar">
                  <i className="rz-c-a" style={{ width: `${artistPct}%` }} />
                  {isBrand && <i className="rz-c-t" style={{ width: `${talentPct}%` }} />}
                  <i className="rz-c-f" style={{ width: `${feePct}%` }} />
                  <i className="rz-c-c" style={{ width: `${causePct}%` }} />
                </div>
                <div className="rz-split-row"><span className="rz-sw rz-c-a" /><span>{leadLabel}</span><span className="rz-amt" style={{ fontWeight: 500 }}>{artistPct}%</span><span className="rz-amt">{money(budgetCents * artistPct / 100)}</span></div>
                {isBrand && <div className="rz-split-row"><span className="rz-sw rz-c-t" /><span>Talent</span><input className="rz-pct" type="number" min={0} max={100} value={talentPct} onChange={(e) => setTalentPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /><span className="rz-amt">{money(budgetCents * talentPct / 100)}</span></div>}
                <div className="rz-split-row"><span className="rz-sw rz-c-f" /><span>Rhozeland fee</span><input className="rz-pct" type="number" min={0} max={100} value={feePct} onChange={(e) => setFeePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /><span className="rz-amt">{money(budgetCents * feePct / 100)}</span></div>
                <div className="rz-split-row"><span className="rz-sw rz-c-c" /><span>{causeLabel}</span><input className="rz-pct" type="number" min={0} max={100} value={causePct} onChange={(e) => setCausePct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /><span className="rz-amt">{money(budgetCents * causePct / 100)}</span></div>
                {causePct > 0 && <input className="rz-in" style={{ marginTop: ".5rem" }} value={causeName} maxLength={120} placeholder={isBrand ? "What is the project share for? (optional)" : "Which cause? (optional)"} onChange={(e) => setCauseName(e.target.value)} />}
              </div>
        </>}
        {simpleStep && <div className="rz-actions rz-wizard-next"><Button variant="outline" className="rz-btn pri" disabled={coverBusy || !!coverFile} onClick={goNext}>Next <ArrowRight size={14} /></Button>{stepKey === "cover" && !cover && <Button variant="ghost" className="rz-wizard-skip" disabled={coverBusy || !!coverFile} onClick={goNext}>Skip for now</Button>}</div>}

        {stepKey === "roadmap" && (
          <>
            <div className="rz-head">
              <h1>Your roadmap</h1>
              <p>Review the milestones and adjust anything before continuing.</p>
            </div>
            <SplitMini />
            <div className="rz-inv">
              <div className="rz-inv-h"><span>#</span><span>Milestone</span><span>Deliverable</span><span style={{ textAlign: "right" }}>Amount</span><span /></div>
              {genBusy && <GenProgress title={title} />}
              {!genBusy && rows.map((r, i) => (
                <div className="rz-row" key={r.id}>
                  <span className="rz-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="rz-row-body">
                    <textarea className="rz-in rz-roadmap-text rz-roadmap-title" rows={2} value={r.title} maxLength={80} aria-label={`Milestone ${i + 1} title`} placeholder="Milestone title" onChange={(e) => updateRow(r.id, { title: e.target.value })} />
                    <textarea className="rz-in rz-roadmap-text rz-roadmap-deliverable" rows={3} value={r.deliverable} maxLength={240} aria-label={`Milestone ${i + 1} deliverable`} placeholder="Specific deliverable, quantity, format and approval criteria" onChange={(e) => updateRow(r.id, { deliverable: e.target.value })} />
                    <div className="rz-money"><span>$</span><input className="rz-in" style={{ textAlign: "right", fontSize: ".78rem" }} inputMode="decimal" value={r.amount_cents ? String(r.amount_cents / 100) : ""} placeholder="0" onChange={(e) => updateRow(r.id, { amount_cents: Math.round((parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0) * 100) })} /></div>
                  </div>
                  <div className="rz-row-ctrl">
                    <Button variant="outline" className="rz-ico" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={13} /></Button>
                    <Button variant="outline" className="rz-ico" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ChevronDown size={13} /></Button>
                    <Button variant="outline" className="rz-ico" aria-label="Delete" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}><Trash2 size={13} /></Button>
                  </div>
                </div>
              ))}
              <div className="rz-inv-f">
                <span>Total {rowsTotal !== budgetCents && <span className="rz-warn">· budget is {money(budgetCents)}</span>}</span>
                <strong>{money(rowsTotal)}</strong>
              </div>
            </div>
            <div className="rz-actions" style={{ marginTop: ".9rem" }}>
              <Button variant="outline" className="rz-btn" disabled={rows.length >= 12 || genBusy} onClick={() => setRows((rs) => [...rs, { id: uid(), title: "", deliverable: "", amount_cents: 0 }])}><Plus size={13} /> Add row</Button>
              <Button variant="outline" className="rz-btn" disabled={genBusy} onClick={generate}>{rows.length ? <RefreshCw size={13} /> : <Sparkles size={13} />} {genBusy ? "Generating…" : rows.length ? "Regenerate" : "Generate"}</Button>
            </div>
            <div className="rz-actions">
              <Button variant="outline" className="rz-btn" onClick={() => { setErr(""); setStepKey("split"); }}><ArrowLeft /> Back</Button>
              <Button variant="outline" className="rz-btn pri" disabled={genBusy} onClick={goStep3}>{isBrand ? "Next: Open roles" : "Next: Coin"} <ArrowRight /></Button>
            </div>
          </>
        )}

        {stepKey === "roles" && (
          <>
            <div className="rz-head">
              <h1>Open roles</h1>
              <p>Optional. List the talent you need, or skip this step.</p>
            </div>
            <div className="rz-inv">
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
            </div>
            <div className="rz-actions" style={{ marginTop: ".9rem" }}>
              <Button variant="outline" className="rz-btn" disabled={roles.length >= 20} onClick={() => setRoles((rs) => [...rs, { id: uid(), name: "", count: "1", rate: "" }])}><Plus size={13} /> Add role</Button>
            </div>
            <div className="rz-actions">
              <Button variant="outline" className="rz-btn" onClick={() => { setErr(""); setStepKey("roadmap"); }}><ArrowLeft /> Back</Button>
              <Button variant="outline" className="rz-btn pri" onClick={goCoin}>Next: Coin <ArrowRight /></Button>
            </div>
          </>
        )}

        {stepKey === "coin" && (
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
                <div style={{ marginTop: ".55rem" }}><Button variant="outline" className="rz-textlink" onClick={skipCoin}>Skip for now</Button></div>
              </div>
            </div>
            <div className="rz-actions">
              <Button variant="outline" className="rz-btn" onClick={() => { setErr(""); setStepKey(isBrand ? "roles" : "roadmap"); }}><ArrowLeft /> Back</Button>
              <Button variant="outline" className="rz-btn pri" disabled={coinBusy} onClick={goStep4}>Next: Review <ArrowRight /></Button>
            </div>
          </>
        )}

        {stepKey === "publish" && (
          <>
            <div className="rz-head">
              <h1>Review and publish</h1>
              <p>Check everything below. You can go back to edit any step.</p>
            </div>
            <div className="rz-split" style={{ marginBottom: ".9rem" }}>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Project</span><b style={{ wordBreak: "break-word" }}>{title}</b></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Type</span><span>{isBrand ? "Brand project" : "Artist project"}</span></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">{leadLabel}</span><span>{name}</span></div>
              <div className="rz-split-row" style={{ gridTemplateColumns: "6rem 1fr" }}><span className="rz-opt">Cover</span>{coverPreview ? <img src={coverPreview} alt="Cover art" style={{ width: 72, height: 40, objectFit: "cover", borderRadius: 6 }} /> : <span className="rz-opt">Gradient placeholder</span>}</div>
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
            {isBrand && (
              <>
                <div style={{ fontSize: ".72rem", fontWeight: 600 }}>Open roles</div>
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
            <div style={{ fontSize: ".72rem", fontWeight: 600 }}>Coin</div>
            <CoinChip />
            <div className="rz-actions">
              <Button variant="outline" className="rz-btn" onClick={() => { setErr(""); setStepKey("coin"); }}><ArrowLeft /> Back</Button>
              <Button variant="outline" className="rz-btn pri" disabled={publishing} onClick={publish}>{publishing ? "Publishing…" : "Publish project"}</Button>
            </div>
            <div style={{ textAlign: "center", marginTop: ".6rem" }}><Button variant="outline" className="rz-textlink" disabled={saving} onClick={() => save(flow.length)}>{saving ? "Saving…" : "Save as draft"}</Button></div>
            <p className="rz-note">Publishing creates a public page anyone with the link can view.</p>
          </>
        )}

        {err && <div className="rz-err">{err}</div>}
        {authFor && <AuthModal onClose={() => { setAuthFor(null); localStorage.removeItem(PENDING_KEY); }} onDone={() => setAuthFor(null)}
          redirectTo={`${location.origin}/create.html?draft=${authFor}&autopublish=1`} />}
        {savedAt && <div className="rz-note rz-saved">Draft saved {savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>}
      </div>
    </Shell>
  );
}
