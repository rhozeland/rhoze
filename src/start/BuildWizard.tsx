// Build Project tab — 4-step wizard. Pre-filled, no AI credits consumed.
import { useEffect, useState, type ElementType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import CopilotQuestionnaire, { type CopilotAnswers } from "./CopilotQuestionnaire";
import type { Session } from "@supabase/supabase-js";
import { Calendar, Camera, Check, Coins, Megaphone, MessageSquare, Music, Palette, Scissors, Sparkles, Video, Wallet } from "lucide-react";

// Pricing model: everything is quoted in CREDITS. 1 credit = $75 CAD.
const CAD_PER_CREDIT = 75;
const CAD_PER_USD = 1.37; // fallback FX for converting the live USD token price
const RHOZE_POOL = "AjCpwQxLsW3SbueGUD2sKpGbbtUPNt64JPcSBJ2uuUiJ";
const GT_POOL = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${RHOZE_POOL}`;

const TYPES = [
  // base = credits (1 credit = $75 CAD)
  { slug: "video", label: "Video Production", hint: "Promo, short film, reels", icon: Video, base: 40 },
  { slug: "photo", label: "Photography", hint: "Brand, product, portrait", icon: Camera, base: 16 },
  { slug: "design", label: "Design", hint: "Identity, UI, print", icon: Palette, base: 20 },
  { slug: "music", label: "Music Production", hint: "Beats, mixing, mastering", icon: Music, base: 18 },
  { slug: "marketing", label: "Marketing", hint: "Strategy, content, ads", icon: Megaphone, base: 12 },
];

const PREFILL: Record<string, { desc: string; goals: string }> = {
  video: { desc: "A short-form promo shot iPhone-first, cut for Reels and TikTok.", goals: "Launch a product/drop with 3–5 usable cuts." },
  photo: { desc: "A half-day brand shoot — lifestyle plus clean product frames.", goals: "20+ retouched selects for web and social." },
  design: { desc: "A brand identity refresh: logo, type, colour, usage rules.", goals: "A cohesive identity kit I can hand to anyone." },
  music: { desc: "Production and mixing for a single, ready for release.", goals: "A mastered track that holds up on streaming." },
  marketing: { desc: "A 30-day content plan with hooks, posting cadence, and ads.", goals: "Grow reach and convert followers into buyers." },
};

const LINES = (slug: string) => {
  const t = TYPES.find((x) => x.slug === slug)!;
  const core = Math.max(1, Math.round(t.base * 0.55));
  const kit = Math.max(1, Math.round(t.base * 0.3));
  const direction = Math.max(1, t.base - core - kit);
  return [
    { name: `${t.label} — core deliverable`, credits: core },
    { name: "Social cutdowns / asset kit", credits: kit },
    { name: "Direction + consultation session", credits: direction },
  ];
};

const money = (n: number) =>
  n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BuildWizard({
  session,
  onDone,
  onNeedAuth,
  onCreated,
}: {
  session: Session | null;
  onDone: () => void;
  onNeedAuth?: () => void;
  onCreated?: (requestId: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<string | null>(null);
  const [answers, setAnswers] = useState<CopilotAnswers>({
    desc: "", goals: "", timeline: "", budget: "", notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [rhozeUsd, setRhozeUsd] = useState<number | null>(null);
  const [applyRhoze, setApplyRhoze] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(GT_POOL)
      .then((r) => r.json())
      .then((j) => {
        const p = Number(j?.data?.attributes?.base_token_price_usd);
        if (alive && Number.isFinite(p) && p > 0) setRhozeUsd(p);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const pick = (slug: string) => {
    setType(slug);
    setAnswers({ desc: "", goals: "", timeline: "", budget: "", notes: "" });
  };

  const lines = type ? LINES(type) : [];
  const totalCredits = lines.reduce((a, l) => a + l.credits, 0);
  const totalCad = totalCredits * CAD_PER_CREDIT;
  const label = TYPES.find((t) => t.slug === type)?.label ?? "";
  const desc = answers.desc.trim() || (type ? PREFILL[type].desc : "");
  const goals = answers.goals.trim() || (type ? PREFILL[type].goals : "");
  const timeline = answers.timeline.trim() || "2–4 weeks";
  const budget = answers.budget.trim() || "Flexible";

  // $RHOZE conversion: live market price → how many tokens equal 1 credit ($75 CAD)
  const rhozeCad = rhozeUsd != null ? rhozeUsd * CAD_PER_USD : null;
  const tokensPerCredit = rhozeCad ? CAD_PER_CREDIT / rhozeCad : null;
  const tokensForTotal = tokensPerCredit ? tokensPerCredit * totalCredits : null;

  const confirm = async () => {
    if (!type) return;
    if (!session) {
      onNeedAuth?.();
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("credit_requests").insert({
        requested_by: session.user.id,
        kind: "custom",
        title: `${label} — new project`,
        proposed_project_title: `${label} — ${session.user.email?.split("@")[0] ?? "client"}`,
        description: `${desc}\n\nGoals: ${goals}\nTimeline: ${timeline}\nBudget: ${budget}${answers.notes.trim() ? `\nNotes: ${answers.notes.trim()}` : ""}\nEstimate: ${totalCredits} credits ($${money(totalCad)} CAD)${applyRhoze && tokensForTotal ? ` · paying with ~${Math.round(tokensForTotal).toLocaleString()} $RHOZE` : ""}`,
        requested_credits: totalCredits,
        estimated_credits: totalCredits,
      }).select("id").maybeSingle();
      if (error) throw error;
      const id = String(data?.id ?? "");
      setRef(id.slice(0, 8).toUpperCase());
      setStep(3);
      if (id && onCreated) onCreated(id);
      else onDone();
    } catch (e) {
      toast({ title: "Couldn't create project", description: (e as Error).message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const steps = ["What to create", "Questionnaire", "Estimate", "Confirm"];

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 min-w-0 ${i === step ? "flex-1" : "sm:flex-1"}`}>
            <span className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-[11px] tabular-nums border ${
              i < step ? "bg-foreground text-background border-foreground"
                : i === step ? "border-foreground" : "border-border text-muted-foreground"}`}>
              {i < step ? <Check className="w-3 h-3" /> : i + 1}
            </span>
            <span className={`text-xs truncate ${i === step ? "text-foreground" : "text-muted-foreground hidden sm:inline"}`}>{s}</span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border hidden sm:block" />}
          </li>
        ))}
      </ol>

      <div className={step === 1 ? "" : "rounded-2xl border border-border bg-card p-5 md:p-6"}>
        {step === 0 && (
          <>
            <h3 className="text-xl tracking-tight">What do you want to create?</h3>
            <p className="text-sm text-muted-foreground mt-1">Pick the service closest to your vision — we pre-fill the rest.</p>
            <div className="mt-4 space-y-2">
              {TYPES.map((t) => (
                <button key={t.slug} onClick={() => pick(t.slug)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    type === t.slug ? "border-foreground bg-muted/40" : "border-border hover:border-foreground/30"}`}>
                  <span className="w-9 h-9 rounded-lg bg-muted grid place-items-center"><t.icon className="w-4 h-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">{t.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            <Button className="mt-5 w-full" disabled={!type} onClick={() => setStep(1)}>Continue →</Button>
          </>
        )}

        {step === 1 && type && (
          <CopilotQuestionnaire
            label={label}
            prefill={PREFILL[type]}
            value={answers}
            onChange={setAnswers}
            onBack={() => setStep(0)}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-xl tracking-tight">Your estimate</h3>
            </div>

            {/* Project summary */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-4">Project summary</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryBlock
                  icon={TYPES.find((t) => t.slug === type)?.icon ?? Video}
                  label="Project type"
                  value={label}
                />
                <SummaryBlock icon={Calendar} label="Timeline" value={timeline} />
                <SummaryBlock icon={Wallet} label="Budget" value={budget} />
              </div>
            </section>

            {/* Breakdown */}
            <section>
              <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-3">Recommended breakdown</div>
              <div className="space-y-3">
                {lines.map((l, i) => {
                  const TypeIcon = TYPES.find((t) => t.slug === type)?.icon ?? Video;
                  const LineIcon = [TypeIcon, Scissors, MessageSquare][i] ?? Check;
                  const descs = [
                    "Primary deliverable for your project",
                    "Reusable cuts for social channels",
                    "Creative direction and review session",
                  ];
                  return (
                    <div key={l.name} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted grid place-items-center shrink-0">
                        <LineIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{descs[i]}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-2xl tabular-nums font-medium">{l.credits}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">${money(l.credits * CAD_PER_CREDIT)} CAD</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Total */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Total estimated</div>
                  <div className="text-4xl tabular-nums font-medium mt-1">
                    {totalCredits.toLocaleString()} <span className="text-lg text-muted-foreground font-normal">credits</span>
                  </div>
                  <div className="text-lg text-muted-foreground tabular-nums mt-0.5">${money(totalCad)} CAD</div>
                  <div className="text-xs text-muted-foreground mt-1">1 credit = ${CAD_PER_CREDIT} CAD</div>
                </div>
                <div className="text-xs text-muted-foreground text-right">Confirmed by the team<br />before any spend</div>
              </div>

              <div className="mt-5 h-2.5 w-full rounded-full bg-muted overflow-hidden flex gap-1">
                {lines.map((l) => (
                  <div
                    key={l.name}
                    style={{ width: `${(l.credits / totalCredits) * 100}%` }}
                    className="h-full rounded-full bg-primary"
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {lines.map((l) => (
                  <div key={l.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span>{l.name} · {l.credits}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* $RHOZE payment */}
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted grid place-items-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">Pay with $RHOZE</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {tokensPerCredit
                      ? <>Live price ${rhozeUsd!.toFixed(6)} USD · 1 credit ≈ {Math.round(tokensPerCredit).toLocaleString()} $RHOZE</>
                      : "Fetching live $RHOZE price…"}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={applyRhoze}
                    onChange={(e) => setApplyRhoze(e.target.checked)}
                    disabled={!tokensPerCredit}
                  />
                  <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary peer-disabled:opacity-50" />
                </label>
              </div>

              {applyRhoze && tokensForTotal && (
                <div className="mt-4 pt-4 border-t border-border flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Token cost for this project</div>
                    <div className="text-2xl tabular-nums font-medium">
                      {Math.round(tokensForTotal).toLocaleString()} <span className="text-sm text-muted-foreground font-normal">$RHOZE</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    Covers {totalCredits} credits<br />(${money(totalCad)} CAD)
                  </div>
                </div>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Hold less than the full amount? Any $RHOZE you send is applied at market value against the CAD total — partial credits round down, the rest is invoiced in CAD.
              </p>
            </section>

            {/* CTAs */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button className="flex-1" disabled={busy} onClick={confirm}>{busy ? "Creating…" : "Confirm project →"}</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 rounded-full bg-foreground text-background grid place-items-center">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-xl tracking-tight">Project confirmed</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Request <span className="font-mono">#{ref}</span> is with the team — they'll be in touch within 24 hours.
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <Button variant="outline" onClick={() => { setStep(0); setType(null); setRef(null); setAnswers({ desc: "", goals: "", timeline: "", budget: "", notes: "" }); }}>Start another</Button>
              <Button onClick={onDone}>View roadmap</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryBlock({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-sm font-medium truncate">{value}</div>
    </div>
  );
}
