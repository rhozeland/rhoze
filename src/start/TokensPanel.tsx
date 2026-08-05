// $RHOZE tab — compact: what it is + what it does, balance, buy, wallet.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Session } from "@supabase/supabase-js";
import { Globe, Info, Palette, ShoppingBag, TrendingUp } from "lucide-react";
import WalletSlot from "./WalletSlot";
import InvestPage from "@/invest/InvestPage";

type Entry = { id: string; delta: number; kind: string; reason: string | null; created_at: string };

const USES = [
  { icon: Palette, title: "Creative services", range: "200–2,000" },
  { icon: ShoppingBag, title: "Clothing & merch", range: "50–500" },
  { icon: Globe, title: "Community access", range: "25–300" },
  { icon: TrendingUp, title: "Back projects", range: "100+" },
];

export default function TokensPanel({ session }: { session: Session }) {
  const [balance, setBalance] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    (async () => {
      const { data: pcs } = await supabase.from("project_clients").select("project_id").eq("user_id", session.user.id);
      const ids = (pcs ?? []).map((r) => r.project_id);
      if (!ids.length) return;
      const { data: bals } = await supabase.from("rhoze_balances").select("balance").in("project_id", ids);
      setBalance((bals ?? []).reduce((a, r: any) => a + Number(r.balance ?? 0), 0));
      const { data: led } = await supabase.from("rhoze_ledger")
        .select("id,delta,kind,reason,created_at").in("project_id", ids)
        .order("created_at", { ascending: false }).limit(25);
      setEntries((led ?? []) as Entry[]);
    })();
  }, [session.user.id]);

  const since = Date.now() - 30 * 864e5;
  const earnedMonth = entries.filter((e) => e.delta > 0 && new Date(e.created_at).getTime() > since)
    .reduce((a, e) => a + e.delta, 0);
  const earnedAll = entries.filter((e) => e.delta > 0).reduce((a, e) => a + e.delta, 0);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-4">
        {/* One compact primer: what it is + what it's for */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
            <div>
              <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">What is $RHOZE?</div>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
                The community currency of Rhozeland — <span className="text-foreground">earned</span> on projects and
                the leaderboard, <span className="text-foreground">spent</span> on services, merch and access.
                No wallet needed; buying more is optional.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {USES.map((u) => (
                <div key={u.title} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <u.icon className="w-3.5 h-3.5 shrink-0" />
                  <div className="leading-tight">
                    <div className="text-xs font-medium whitespace-nowrap">{u.title}</div>
                    <div className="text-[10px] tabular-nums text-muted-foreground">{u.range} $RHOZE</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-[340px_1fr] gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Current balance</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl tabular-nums">{balance.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground mb-1">$RHOZE</span>
            </div>
            <Button className="mt-4 w-full" onClick={() => document.getElementById("rhoze-buy")?.scrollIntoView({ behavior: "smooth" })}>
              Buy $RHOZE
            </Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Stat label="Earned this month" value={`+${earnedMonth.toLocaleString()}`} />
            <Stat
              label="Total earned (all-time)"
              value={earnedAll.toLocaleString()}
              hint="Earn $RHOZE by running projects with us and by climbing the community leaderboard."
              link={{ label: "See the leaderboard →", href: "/leaderboard.html" }}
            />
          </div>
        </div>

        <WalletSlot session={session} />

        {/* Buying / investing lives here — no separate Invest page. */}
        <section id="rhoze-buy">
          <InvestPage embedded />
        </section>
      </div>
    </TooltipProvider>
  );
}

function Stat({ label, value, hint, link }: {
  label: string; value: string; hint?: string; link?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground">
                <Info className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[230px] text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="mt-1 text-2xl tabular-nums">{value}</div>
      {link && (
        <a href={link.href} target="_top" className="mt-1 inline-block text-[11px] text-foreground underline underline-offset-4">
          {link.label}
        </a>
      )}
    </div>
  );
}
