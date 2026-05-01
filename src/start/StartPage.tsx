import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Camera, Music2, Activity, Minus, Plus, Info, ArrowRight } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

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

export default function StartPage() {
  const [step, setStep] = useState<"intro" | "build" | "review" | "checkout">("intro");
  const [path, setPath] = useState<"subscribe" | "project" | null>(null);
  const [activeCat, setActiveCat] = useState<Category>("visual");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [tierSlug, setTierSlug] = useState<string>("");
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
            1 credit ≈ {fmt(CREDIT_VALUE_CENTS)} of work. Final scope is confirmed on a kickoff call before any non-deposit payment.
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
                  <span className="font-medium text-foreground">{totalCredits}</span> credits · est. <span className="font-medium text-foreground">{fmt(estimateCents)}</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {path === "subscribe"
                ? "Each tier grants monthly credits you spend on any service in the catalog below. Unused credits roll over while your subscription is active — pick the size that matches your output."
                : "Select what you'd like delivered. We'll quote it in credits — you can convert to a subscription on the next step if you'd save money."}
            </p>
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
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {inCat.map(s => {
                const qty = cart[s.id] ?? 0;
                const active = qty > 0;
                return (
                  <button
                    key={s.id}
                    onClick={() => addToCart(s)}
                    className={`rounded-full px-4 py-2 text-sm border transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
                  >
                    {s.name} <span className={`ml-1.5 text-xs ${active ? "opacity-80" : "text-muted-foreground"}`}>· {s.credits_cost} cr</span>
                  </button>
                );
              })}
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
                      <div className="text-xs text-muted-foreground">{s.credits_cost} credits each{s.min_quantity > 1 ? ` · min ${s.min_quantity}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(s, -1)}><Minus size={14} /></Button>
                      <div className="w-6 text-center text-sm tabular-nums">{qty}</div>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => changeQty(s, 1)}><Plus size={14} /></Button>
                      <div className="w-16 text-right text-sm tabular-nums text-muted-foreground">{qty * s.credits_cost} cr</div>
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
                    <span className="text-muted-foreground tabular-nums">{(cart[s.id] ?? 0) * s.credits_cost} cr</span>
                  </div>
                ))}
                <div className="border-t border-border pt-3 flex justify-between text-sm">
                  <span className="font-medium">Estimate</span>
                  <span className="font-medium">{totalCredits} credits · {fmt(estimateCents)}</span>
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
