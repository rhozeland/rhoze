import { useState, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Music2, Activity, Minus, Plus, Info, ArrowRight, CalendarClock, Search, X } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Pkg = {
  id: string; slug: string; name: string; kind: string; category: string | null;
  description: string | null; price_cents: number; credits: number;
  credits_cost: number; min_quantity: number;
  billing_interval: string | null; stripe_price_id: string | null; sort_order: number;
};

type Category = "visual" | "audio" | "development";

const CATEGORIES: { id: Category; label: string; Icon: typeof Camera }[] = [
  { id: "visual", label: "Visual", Icon: Camera },
  { id: "audio", label: "Audio", Icon: Music2 },
  { id: "development", label: "Development", Icon: Activity },
];

const CREDIT_VALUE_CENTS = 7500; // 1 credit = $75 baseline
const DEPOSIT_PERCENT = 0.30;    // 30% deposit to begin
const DEPOSIT_MIN_CENTS = 5000;  // Stripe min
const SCOPE_CALL_URL = "https://calendar.app.google/cXfhA8SeNLXeBYNdA";

type ServiceDetail = {
  scope: string;
  deliverables: string[];
  revisions: string;
  turnaround: string;
  notIncluded?: string[];
};

const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  // ---- Visual ----
  "photo-shoot": {
    scope: "Half-day shoot, ~3 hours on location or in our studio. One creative direction, one outfit/setup family.",
    deliverables: ["Up to 40 color-graded stills (web + print res)", "Online gallery for selects", "Lifestyle, portrait, or product framing"],
    revisions: "One round of re-edits on selected images (color, crop, light retouch).",
    turnaround: "5–7 business days from shoot date.",
    notIncluded: ["Travel beyond 25 mi", "Heavy retouching / compositing", "Hair, makeup, or talent"],
  },
  "content-edit": {
    scope: "One polished long-form edit (3–8 minutes) from your supplied footage.",
    deliverables: ["Edited master in 4K or 1080p", "Color pass + sound balance", "Royalty-safe music if needed"],
    revisions: "Two rounds of timed revisions.",
    turnaround: "7–10 business days after footage delivery.",
    notIncluded: ["Original shooting", "Motion graphics beyond title cards", "Licensed music clearance"],
  },
  "commercial-edit": {
    scope: "One commercial-grade cut, 15–60 seconds, agency-ready.",
    deliverables: ["Master + 9:16 and 1:1 reframes", "Full color grade + sound design", "Logo / endcard treatment"],
    revisions: "Two revision rounds before final lock.",
    turnaround: "7–10 business days.",
    notIncluded: ["Concept board / storyboard from scratch (add Strategy consult)", "VFX-heavy compositing"],
  },
  "short-form-edit": {
    scope: "One vertical edit for Reels / TikTok / Shorts, ≤90 seconds.",
    deliverables: ["9:16 master with captions", "Hook variant for A/B testing", "Trend-aware pacing"],
    revisions: "Two revision rounds.",
    turnaround: "3–5 business days.",
    notIncluded: ["Account posting / scheduling", "Original shooting"],
  },
  "mv-edit": {
    scope: "One full music-video edit synced to a single track from your footage.",
    deliverables: ["Edited master in 4K or 1080p", "Color grade + transition design", "Mixdown sync to provided audio"],
    revisions: "Two revision rounds.",
    turnaround: "10–14 business days.",
    notIncluded: ["VFX / 3D shots", "On-set direction (book Photo shoot for capture)"],
  },
  // ---- Audio ----
  "audio-recording": {
    scope: "Two-hour tracking session in our room with engineer. Sold in 2-credit blocks; book more for longer sessions.",
    deliverables: ["Multi-track session files", "Rough monitor mix for reference", "Up to 3 vocalists / one band setup"],
    revisions: "Re-tracking inside the booked window is included; additional time is billed at the same rate.",
    turnaround: "Same-day session export; raw files within 48 hrs.",
    notIncluded: ["Mixing or mastering (separate credits)", "Beat / instrumental production"],
  },
  "mixing": {
    scope: "Mix one song to release standard. Stems in, mix-bus out.",
    deliverables: ["Stereo mix (WAV 24-bit)", "Instrumental + acapella stems", "Reference-matched balance"],
    revisions: "Two recall / revision rounds.",
    turnaround: "5–7 business days from stem delivery.",
    notIncluded: ["Mastering", "Vocal tuning beyond standard correction (add a credit for heavy comping)"],
  },
  "mastering": {
    scope: "Master one track for streaming + DSP delivery, loudness-matched per platform.",
    deliverables: ["Mastered WAV + MP3", "DDP / streaming-ready file", "LUFS-matched for Spotify / Apple"],
    revisions: "One revision round.",
    turnaround: "2–3 business days.",
    notIncluded: ["Stem mastering (counts as 2 credits)", "Mix corrections"],
  },
  "podcast": {
    scope: "Two-hour multi-mic podcast session, in-room or remote-coordinated.",
    deliverables: ["One edited episode (≤60 min)", "Level + noise pass per speaker", "Intro / outro stitch from your assets"],
    revisions: "One revision round per episode.",
    turnaround: "3–5 business days post-session.",
    notIncluded: ["Show artwork / branding (see Graphic design)", "Distribution upload"],
  },
  // ---- Development ----
  "design": {
    scope: "One hour of flexible design work — tweaks, layouts, or a small request.",
    deliverables: ["Editable source file (Figma / PSD / AI)", "Exported assets for web or print"],
    revisions: "Iterations within the booked hour are included.",
    turnaround: "Same or next business day.",
    notIncluded: ["Net-new brand identity (book a multi-credit block)"],
  },
  "graphic-design": {
    scope: "One social-asset graphic — cover art, flyer, or a single carousel slide.",
    deliverables: ["Final PNG / JPG at platform spec", "Editable source file on request"],
    revisions: "Two revision rounds.",
    turnaround: "2–3 business days.",
    notIncluded: ["Multi-slide carousels (1 credit per slide)", "Animated assets"],
  },
  "web-development": {
    scope: "Full small-site build, ≈4–6 pages, responsive and deployed.",
    deliverables: ["Live deployed site", "CMS-light content blocks", "Basic SEO + analytics setup"],
    revisions: "Two structured revision rounds before launch; copy edits welcomed throughout.",
    turnaround: "3–4 weeks from kickoff.",
    notIncluded: ["Custom backend / auth (scope separately)", "Logo or brand identity work", "Ongoing maintenance retainer"],
  },
  "uiux-development": {
    scope: "Two-week UI/UX sprint focused on one product surface.",
    deliverables: ["User flow map", "Wireframes for key screens", "Clickable Figma prototype"],
    revisions: "Two structured review rounds during the sprint.",
    turnaround: "Two weeks from kickoff.",
    notIncluded: ["Production front-end build (see Web development)", "User research recruitment"],
  },
  "consult": {
    scope: "One-hour strategy call — brand, roadmap, or release planning.",
    deliverables: ["Recorded session", "Written follow-up with priorities + next steps"],
    revisions: "Async follow-up questions for 7 days after the call.",
    turnaround: "Booked within 3 business days.",
    notIncluded: ["Execution work — pair with relevant service credits"],
  },
};

export default function StartPage() {
  const [step, setStep] = useState<"intro" | "build" | "review" | "checkout">("intro");
  const [path, setPath] = useState<"subscribe" | "project" | null>(null);
  const [activeCat, setActiveCat] = useState<Category>("visual");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tierSlug, setTierSlug] = useState<string>("");
  const [detailsFor, setDetailsFor] = useState<Pkg | null>(null);
  const [search, setSearch] = useState("");
  const [contact, setContact] = useState({
    name: "", email: "", phone: "", scope: "",
    region: "US" as "US" | "International",
    agree: false,
  });

  const { data: pkgs } = useQuery<Pkg[]>({
    queryKey: ["start_packages_v2"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_packages").select("*").eq("is_active", true).order("sort_order").order("price_cents");
      if (error) throw error;
      return data as Pkg[];
    },
  });

  const tiers = useMemo(() => (pkgs ?? []).filter(p => p.kind === "subscription"), [pkgs]);
  const services = useMemo(() => (pkgs ?? []).filter(p => p.kind === "a_la_carte"), [pkgs]);
  const inCat = useMemo(() => services.filter(s => s.category === activeCat), [services, activeCat]);

  const trimmedSearch = search.trim().toLowerCase();
  const isSearching = trimmedSearch.length > 0;
  const visibleServices = useMemo(() => {
    if (!isSearching) return inCat;
    return services.filter(s => {
      const hay = `${s.name} ${s.description ?? ""} ${s.category ?? ""}`.toLowerCase();
      return hay.includes(trimmedSearch);
    });
  }, [services, inCat, isSearching, trimmedSearch]);
  const matchCountByCat = useMemo(() => {
    if (!isSearching) return {} as Record<string, number>;
    return visibleServices.reduce<Record<string, number>>((acc, s) => {
      const k = s.category ?? "other";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
  }, [visibleServices, isSearching]);

  const selected = useMemo(() => services.filter(s => (cart[s.id] ?? 0) > 0), [services, cart]);
  const totalCredits = useMemo(() => selected.reduce((sum, s) => sum + s.credits_cost * (cart[s.id] ?? 0), 0), [selected, cart]);
  const estimateCents = totalCredits * CREDIT_VALUE_CENTS;
  const depositCents = Math.max(DEPOSIT_MIN_CENTS, Math.round(estimateCents * DEPOSIT_PERCENT));

  const selectedTier = tiers.find(t => t.slug === tierSlug);
  const tierCreditValue = selectedTier && selectedTier.credits > 0 ? selectedTier.price_cents / selectedTier.credits : null;
  const subscriberSavings = tierCreditValue ? Math.max(0, estimateCents - totalCredits * tierCreditValue) : 0;

  const fmt = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

  function addToCart(pkg: Pkg) {
    setCart(c => ({ ...c, [pkg.id]: Math.max(c[pkg.id] ?? 0, pkg.min_quantity) }));
  }
  function changeQty(pkg: Pkg, delta: number) {
    setCart(c => {
      const cur = c[pkg.id] ?? 0;
      const next = cur + delta;
      if (next <= 0) { const { [pkg.id]: _, ...rest } = c; return rest; }
      return { ...c, [pkg.id]: Math.max(pkg.min_quantity, next) };
    });
  }

  // ---------- INTRO ----------
  if (step === "intro") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PaymentTestModeBanner />
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center space-y-8">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Rhozeland</div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">Start a project</h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Two ways to work with us. Subscribe to a monthly retainer for ongoing creative output,
            or scope a single project and pay a deposit to kick it off.
          </p>

          <div className="grid md:grid-cols-2 gap-4 pt-6 text-left">
            <button
              onClick={() => { setPath("subscribe"); setStep("build"); }}
              className="border border-border rounded-2xl p-6 bg-card hover:border-primary/60 transition-colors space-y-3"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Best value</div>
              <div className="text-xl font-semibold">Subscribe</div>
              <p className="text-sm text-muted-foreground">
                Get a credit allowance every month — spend it on any service. Cheaper per credit than buying à la carte.
              </p>
              <div className="flex items-center gap-1 text-sm font-medium pt-2">Choose a plan <ArrowRight size={14} /></div>
            </button>
            <button
              onClick={() => { setPath("project"); setStep("build"); }}
              className="border border-border rounded-2xl p-6 bg-card hover:border-primary/60 transition-colors space-y-3"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">One-off</div>
              <div className="text-xl font-semibold">Scope a project</div>
              <p className="text-sm text-muted-foreground">
                Pick the services you need, get a credit-based estimate, and put down a refundable deposit to begin.
              </p>
              <div className="flex items-center gap-1 text-sm font-medium pt-2">Build estimate <ArrowRight size={14} /></div>
            </button>
          </div>

          <div className="text-xs text-muted-foreground pt-4 max-w-md mx-auto">
            1 credit = {fmt(CREDIT_VALUE_CENTS)} = one focused creative session. Final scope is confirmed on a kickoff call before any non-deposit payment.
          </div>
        </div>
      </div>
    );
  }

  // ---------- BUILD ----------
  if (step === "build") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PaymentTestModeBanner />
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
          <header className="space-y-3">
            <button onClick={() => setStep("intro")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-2xl md:text-3xl font-semibold">
                {path === "subscribe" ? "Choose your plan" : "Build your estimate"}
              </h1>
              {path === "project" && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{totalCredits}</span> {totalCredits === 1 ? "credit" : "credits"} · est. <span className="font-medium text-foreground">{fmt(estimateCents)}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {path === "subscribe"
                ? "Each tier grants monthly credits you spend on any service in the catalog below. Unused credits roll over while your subscription is active — pick the size that matches your output."
                : "Select what you'd like delivered. We'll quote it in credits — you can convert to a subscription on the next step if you'd save money."}
            </p>

            {/* Credit anchor — make the unit unmistakable */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 mt-2">
              <div className="text-sm">
                <span className="font-semibold text-foreground">1 credit = {fmt(CREDIT_VALUE_CENTS)}</span>
                <span className="text-muted-foreground"> · one focused creative session (≈ a half-day of work, one deliverable)</span>
              </div>
              <a
                href={SCOPE_CALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-4 hover:text-primary"
              >
                <CalendarClock size={13} /> Not sure? Book a free 15-min scope call
              </a>
            </div>
          </header>

          {/* Subscription tiers (for subscribe path) */}
          {path === "subscribe" && (
            <div className="grid gap-3 md:grid-cols-3">
              {tiers.map(t => {
                const perCredit = t.credits > 0 ? t.price_cents / t.credits : 0;
                const isPicked = tierSlug === t.slug;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTierSlug(t.slug)}
                    className={`text-left border rounded-2xl p-5 transition-colors ${isPicked ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{t.name}</div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-semibold">{fmt(t.price_cents)}</span>
                      <span className="text-xs text-muted-foreground">/mo</span>
                    </div>
                    <div className="mt-1 text-sm">{t.credits} credits</div>
                    <div className="text-xs text-muted-foreground">{fmt(perCredit)}/credit</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Funnel: category pills */}
          <div className="space-y-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              {path === "subscribe" ? "What you can spend credits on" : "Services"}
            </div>
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 p-1 border border-border">
                {CATEGORIES.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveCat(id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${activeCat === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Service chips */}
            <div className="grid sm:grid-cols-2 gap-2 pt-2">
              {inCat.map(s => {
                const qty = cart[s.id] ?? 0;
                const active = qty > 0;
                const creditLabel = `${s.credits_cost} ${s.credits_cost === 1 ? "credit" : "credits"}`;
                return (
                  <div
                    key={s.id}
                    onClick={() => addToCart(s)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); addToCart(s); } }}
                    className={`relative text-left rounded-xl px-4 py-3 border transition-colors cursor-pointer ${active ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
                  >
                    <div className="flex items-baseline justify-between gap-3 pr-7">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className={`text-xs tabular-nums shrink-0 ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>{creditLabel}</span>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pr-7">{s.description}</p>
                    )}
                    {s.min_quantity > 1 && (
                      <p className="text-[11px] text-muted-foreground mt-1">Sold in packs of {s.min_quantity}+</p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDetailsFor(s); }}
                      aria-label={`What this credit includes for ${s.name}`}
                      className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                );
              })}
              {inCat.length === 0 && (
                <div className="col-span-full text-center text-sm text-muted-foreground py-6">
                  More services coming to this category soon.
                </div>
              )}
            </div>
          </div>

          {/* Selected list (à la carte path mainly, but visible always) */}
          {selected.length > 0 && path === "project" && (
            <div className="space-y-2 border-t border-border pt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your selection</div>
              {selected.map(s => {
                const qty = cart[s.id] ?? 0;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-3 border border-border rounded-lg px-4 py-3 bg-card">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.credits_cost} {s.credits_cost === 1 ? "credit" : "credits"} each{s.min_quantity > 1 ? ` · min ${s.min_quantity}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(s, -1)}><Minus size={14} /></Button>
                      <div className="w-6 text-center text-sm tabular-nums">{qty}</div>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(s, 1)}><Plus size={14} /></Button>
                      <div className="w-20 text-right text-sm tabular-nums text-muted-foreground">{qty * s.credits_cost} {qty * s.credits_cost === 1 ? "credit" : "credits"}</div>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg p-3 mt-3">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>This is a self-service estimate. Final credit count is confirmed after a quick scoping call — your deposit is refundable within 7 days if scope shifts and you decide not to proceed.</span>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setStep("review")}
              disabled={path === "subscribe" ? !tierSlug : selected.length === 0}
            >
              Continue <ArrowRight size={14} className="ml-1.5" />
            </Button>
          </div>
        </div>
        <ServiceDetailsDialog pkg={detailsFor} onClose={() => setDetailsFor(null)} onAdd={(p) => { addToCart(p); setDetailsFor(null); }} fmt={fmt} />
      </div>
    );
  }

  // ---------- REVIEW ----------
  if (step === "review") {
    const canProceed = contact.name && contact.email && contact.agree;
    return (
      <div className="min-h-screen bg-background text-foreground">
        <PaymentTestModeBanner />
        <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
          <button onClick={() => setStep("build")} className="text-xs text-muted-foreground hover:text-foreground">← Back</button>
          <h1 className="text-2xl md:text-3xl font-semibold">Your details</h1>

          {/* Summary */}
          <div className="border border-border rounded-2xl p-5 bg-card space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Summary</div>
            {path === "subscribe" && selectedTier && (
              <div className="flex justify-between text-sm">
                <span>{selectedTier.name} subscription</span>
                <span className="font-medium">{fmt(selectedTier.price_cents)}/mo · {selectedTier.credits} credits</span>
              </div>
            )}
            {path === "project" && (
              <>
                {selected.map(s => (
                  <div key={s.id} className="flex justify-between text-sm">
                    <span>{s.name} × {cart[s.id]}</span>
                    <span className="text-muted-foreground tabular-nums">{(cart[s.id] ?? 0) * s.credits_cost} {(cart[s.id] ?? 0) * s.credits_cost === 1 ? "credit" : "credits"}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-3 flex justify-between text-sm">
                  <span className="font-medium">Estimate</span>
                  <span className="font-medium">{totalCredits} {totalCredits === 1 ? "credit" : "credits"} · {fmt(estimateCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Deposit to begin (30%, refundable 7 days)</span>
                  <span className="font-medium">{fmt(depositCents)}</span>
                </div>
                {tiers.length > 0 && tierCreditValue && subscriberSavings > 0 && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 mt-2">
                    💡 As a subscriber on the cheapest qualifying tier, the same scope would cost about <span className="text-foreground font-medium">{fmt(totalCredits * tierCreditValue)}</span> — save {fmt(subscriberSavings)}.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Name *</Label><Input value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Region</Label>
                <div className="inline-flex rounded-lg border border-border p-1 bg-muted/30 w-full">
                  {(["US", "International"] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setContact({ ...contact, region: r })}
                      className={`flex-1 px-3 py-1.5 text-sm rounded-md transition-colors ${contact.region === r ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >{r}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tell us about the project</Label>
              <Textarea
                rows={4}
                value={contact.scope}
                onChange={e => setContact({ ...contact, scope: e.target.value })}
                placeholder="Goals, references, timeline, anything that helps us scope it accurately."
              />
              <p className="text-xs text-muted-foreground">The more detail you share, the more accurate our follow-up estimate will be.</p>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={contact.agree} onCheckedChange={v => setContact({ ...contact, agree: !!v })} />
              <span>
                I understand this is an initial estimate. {path === "project"
                  ? "The deposit secures the kickoff slot and is refundable within 7 days if we can't agree on scope. Remaining payments are due at agreed milestones."
                  : "Subscriptions renew monthly until canceled. Unused credits roll over while your subscription stays active."}
              </span>
            </label>

            <div className="flex justify-end">
              <Button onClick={() => setStep("checkout")} disabled={!canProceed}>
                {path === "subscribe" ? "Continue to payment" : `Pay deposit ${fmt(depositCents)}`}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- CHECKOUT ----------
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
        <Button variant="outline" size="sm" onClick={() => setStep("review")}>← Back</Button>
        <StripeEmbeddedCheckout
          {...(path === "subscribe"
            ? { subscriptionPriceId: selectedTier?.stripe_price_id ?? undefined }
            : { depositCents: depositCents })}
          customerEmail={contact.email}
          customerName={contact.name}
          customerPhone={contact.phone || undefined}
          customerCountry={contact.region === "US" ? "US" : undefined}
          message={
            path === "project"
              ? `Estimate: ${totalCredits} credits / ${fmt(estimateCents)}. Selection: ${selected.map(s => `${s.name} x${cart[s.id]}`).join(", ")}. Scope: ${contact.scope}`
              : contact.scope
          }
          returnUrl={`${window.location.origin}/start.html#/return?session_id={CHECKOUT_SESSION_ID}`}
        />
      </div>
    </div>
  );
}

function ServiceDetailsDialog({
  pkg,
  onClose,
  onAdd,
  fmt,
}: {
  pkg: Pkg | null;
  onClose: () => void;
  onAdd: (p: Pkg) => void;
  fmt: (c: number) => string;
}) {
  const open = !!pkg;
  const detail = pkg ? SERVICE_DETAILS[pkg.slug] : undefined;
  const creditLabel = pkg ? `${pkg.credits_cost} ${pkg.credits_cost === 1 ? "credit" : "credits"}` : "";
  const dollarLabel = pkg ? fmt(pkg.credits_cost * CREDIT_VALUE_CENTS) : "";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        {pkg && (
          <>
            <DialogHeader>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{pkg.category}</div>
              <DialogTitle className="text-xl">{pkg.name}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                  {creditLabel} · {dollarLabel}
                </span>
                {pkg.min_quantity > 1 && (
                  <span className="text-xs text-muted-foreground">Sold in packs of {pkg.min_quantity}+</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-2 text-sm">
              {detail ? (
                <>
                  <Section label="Scope">
                    <p className="text-muted-foreground">{detail.scope}</p>
                  </Section>
                  <Section label="What you get">
                    <ul className="space-y-1 text-muted-foreground">
                      {detail.deliverables.map((d, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary">·</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                  <div className="grid grid-cols-2 gap-4">
                    <Section label="Revisions">
                      <p className="text-muted-foreground">{detail.revisions}</p>
                    </Section>
                    <Section label="Turnaround">
                      <p className="text-muted-foreground">{detail.turnaround}</p>
                    </Section>
                  </div>
                  {detail.notIncluded && detail.notIncluded.length > 0 && (
                    <Section label="Not included">
                      <ul className="space-y-1 text-muted-foreground">
                        {detail.notIncluded.map((d, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-muted-foreground/60">×</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">{pkg.description ?? "Details coming soon — book a free scope call and we'll walk through it."}</p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-4 border-t border-border">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => onAdd(pkg)}>Add to estimate</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground/80 font-medium">{label}</div>
      {children}
    </div>
  );
}
