import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

type Pkg = { id: string; slug: string; name: string; kind: string; description: string | null; price_cents: number; credits: number; billing_interval: string | null; stripe_price_id: string | null; sort_order: number };

export default function StartPage() {
  const [tab, setTab] = useState<"subscribe" | "alacarte">("subscribe");
  const [tierSlug, setTierSlug] = useState<string>("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [deposit, setDeposit] = useState<string>("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "", country: "US", message: "", agree: false });
  const [showCheckout, setShowCheckout] = useState(false);

  const { data: pkgs } = useQuery<Pkg[]>({
    queryKey: ["start_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_packages").select("*").eq("is_active", true).order("sort_order").order("price_cents");
      if (error) throw error;
      return data as Pkg[];
    },
  });

  const tiers = useMemo(() => (pkgs ?? []).filter((p) => p.kind === "subscription"), [pkgs]);
  const aLaCarte = useMemo(() => (pkgs ?? []).filter((p) => p.kind === "a_la_carte"), [pkgs]);

  const totalCents = useMemo(() => {
    let total = 0;
    for (const p of aLaCarte) total += (cart[p.id] ?? 0) * p.price_cents;
    const dep = Math.round(parseFloat(deposit || "0") * 100);
    if (dep > 0) total += dep;
    return total;
  }, [cart, aLaCarte, deposit]);

  const canCheckoutSub = !!tierSlug && contact.name && contact.email && contact.agree;
  const canCheckoutOne = totalCents >= 5000 && contact.name && contact.email && contact.agree;

  const selectedTier = tiers.find((t) => t.slug === tierSlug);
  const cartLines = aLaCarte
    .filter((p) => (cart[p.id] ?? 0) > 0 && p.stripe_price_id)
    .map((p) => ({ priceId: p.stripe_price_id!, quantity: cart[p.id] }));
  const depCents = Math.round(parseFloat(deposit || "0") * 100);

  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
        <header className="space-y-2">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland</div>
          <h1 className="text-3xl md:text-4xl font-semibold">Start a project</h1>
          <p className="text-sm text-muted-foreground max-w-prose">Subscribe to a monthly retainer for ongoing creative work, or pay as you go for a single session. Got something custom in mind? Add a deposit and we'll set up a project ledger for you.</p>
        </header>

        {!showCheckout && (
          <>
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="subscribe">Subscribe</TabsTrigger>
                <TabsTrigger value="alacarte">Pay as you go</TabsTrigger>
              </TabsList>

              <TabsContent value="subscribe" className="mt-4 space-y-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Choose a tier</div>
                <div className="grid gap-3">
                  {tiers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTierSlug(t.slug)}
                      className={`text-left border rounded-lg p-4 transition-colors ${tierSlug === t.slug ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-medium">{t.name}</div>
                        <div className="text-sm">{fmt(t.price_cents)}<span className="text-muted-foreground">/mo</span></div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{t.credits} credits per month · {t.description}</div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="alacarte" className="mt-4 space-y-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Add services</div>
                <div className="grid gap-2">
                  {aLaCarte.map((p) => {
                    const qty = cart[p.id] ?? 0;
                    return (
                      <div key={p.id} className="border border-border rounded-lg p-3 bg-card flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{p.name}</div>
                          {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-sm">{fmt(p.price_cents)}</div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" onClick={() => setCart({ ...cart, [p.id]: Math.max(0, qty - 1) })}>−</Button>
                            <div className="w-6 text-center text-sm">{qty}</div>
                            <Button size="sm" variant="outline" onClick={() => setCart({ ...cart, [p.id]: qty + 1 })}>+</Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <Label>Custom project deposit ($, optional)</Label>
                  <Input type="number" step="1" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="e.g. 500" />
                  <p className="text-xs text-muted-foreground">Funds go straight to your project's dollar balance. Minimum total $50 to checkout.</p>
                </div>

                <div className="text-right text-sm font-medium">Total: {fmt(totalCents)}</div>
              </TabsContent>
            </Tabs>

            <div className="space-y-3 border-t border-border pt-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Your details</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Name *</Label><Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Phone</Label><Input value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Country (2-letter)</Label><Input maxLength={2} value={contact.country} onChange={(e) => setContact({ ...contact, country: e.target.value.toUpperCase() })} /></div>
              </div>
              <div className="space-y-1.5"><Label>Tell us about the project</Label><Textarea rows={3} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} /></div>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <Checkbox checked={contact.agree} onCheckedChange={(v) => setContact({ ...contact, agree: !!v })} />
                <span>I agree that booked sessions are non-refundable once scheduled, and subscriptions renew monthly until canceled.</span>
              </label>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setShowCheckout(true)}
                disabled={tab === "subscribe" ? !canCheckoutSub : !canCheckoutOne}
              >
                Continue to payment
              </Button>
            </div>
          </>
        )}

        {showCheckout && (
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={() => setShowCheckout(false)}>← Back</Button>
            <StripeEmbeddedCheckout
              {...(tab === "subscribe"
                ? { subscriptionPriceId: selectedTier?.stripe_price_id ?? undefined }
                : { cart: cartLines, depositCents: depCents > 0 ? depCents : undefined })}
              customerEmail={contact.email}
              customerName={contact.name}
              customerPhone={contact.phone || undefined}
              customerCountry={contact.country || undefined}
              message={contact.message || undefined}
              returnUrl={`${window.location.origin}/start.html#/return?session_id={CHECKOUT_SESSION_ID}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}