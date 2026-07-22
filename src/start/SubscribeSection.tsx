// Inline subscribe section: uses brand palette from index.css, frames
// credits with an approximate dollar-value hint, and mounts embedded
// Stripe checkout below the tier grid when chosen. Kills the modal path.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import type { Session } from "@supabase/supabase-js";
import { Coins, Check, Loader2, X } from "lucide-react";

type Tier = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  credits: number | null;
  billing_interval: string | null;
  sort_order: number | null;
};

// Rough per-credit value for framing. Adjust when packages change.
const CREDIT_VALUE_CENTS = 3500;

export default function SubscribeSection({
  session, onNeedAuth,
}: { session: Session | null; onNeedAuth: () => void }) {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("service_packages")
        .select("id,slug,name,description,price_cents,credits,billing_interval,sort_order")
        .eq("kind", "subscription")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setTiers((data ?? []) as Tier[]);
    })();
  }, []);

  const start = (s: string) => {
    if (!session) { onNeedAuth(); return; }
    setSlug(s);
  };

  return (
    <section id="subscribe" className="scroll-mt-16">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Retainer</div>
          <h2 className="text-2xl md:text-3xl tracking-tight mt-1 text-foreground">Subscribe & save on credits</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Monthly credits refresh, priority queue, and $RHOZE loyalty yield on every dollar. Cancel anytime.
          </p>
        </div>
      </div>

      {slug ? (
        <div className="rounded-2xl border border-border bg-card p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs text-muted-foreground">Complete checkout</div>
            <Button variant="ghost" size="sm" onClick={() => setSlug(null)}>
              <X className="w-3.5 h-3.5 mr-1" /> Back to plans
            </Button>
          </div>
          <div className="min-h-[560px]">
            <StripeEmbeddedCheckout
              subscriptionSlug={slug}
              customerEmail={session?.user?.email}
              userId={session?.user?.id}
              returnUrl={`${window.location.origin}/start.html?checkout=return`}
            />
          </div>
        </div>
      ) : tiers === null ? (
        <div className="rounded-2xl border border-border bg-card p-10 flex items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading tiers…
        </div>
      ) : tiers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No subscription tiers are published yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((t, i) => {
            const credits = t.credits ?? 0;
            const value = credits * CREDIT_VALUE_CENTS;
            const savings = Math.max(0, value - t.price_cents);
            const featured = i === 1;
            return (
              <div
                key={t.id}
                className={`relative rounded-2xl p-5 flex flex-col border transition-all ${
                  featured
                    ? "border-primary/60 bg-primary/5 shadow-[var(--shadow-lift)]"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {featured && (
                  <span className="absolute -top-2 left-5 text-[10px] uppercase tracking-[0.2em] bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                    Most picked
                  </span>
                )}
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t.billing_interval ?? "month"}
                </div>
                <div className="text-lg mt-1 text-foreground">{t.name}</div>
                <div className="text-3xl mt-2 tabular-nums text-foreground">
                  ${(t.price_cents / 100).toFixed(0)}
                  <span className="text-sm text-muted-foreground">/mo</span>
                </div>

                <div className="mt-4 rounded-xl bg-background/60 border border-border p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Credits</div>
                  <div className="text-2xl tabular-nums text-foreground">{credits}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    ≈ ${(value / 100).toFixed(0)} of studio work
                    {savings > 0 && <span className="text-primary"> · save ${(savings / 100).toFixed(0)}/mo</span>}
                  </div>
                </div>

                <ul className="text-xs text-muted-foreground mt-4 space-y-1.5 flex-1">
                  <li className="flex items-start gap-2"><Check className="w-3 h-3 mt-0.5 text-primary shrink-0" /> Priority queue</li>
                  <li className="flex items-start gap-2"><Check className="w-3 h-3 mt-0.5 text-primary shrink-0" /> Rollover unused credits (30d)</li>
                  <li className="flex items-start gap-2"><Coins className="w-3 h-3 mt-0.5 text-primary shrink-0" /> $RHOZE yield per dollar spent</li>
                  {t.description && <li className="text-muted-foreground/80 pt-1">{t.description}</li>}
                </ul>

                <Button
                  onClick={() => start(t.slug)}
                  className="mt-4 w-full"
                  variant={featured ? "default" : "outline"}
                >
                  Choose {t.name}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}