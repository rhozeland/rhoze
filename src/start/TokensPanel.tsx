// $RHOZE tab — utility-first token view: balance, flows, catalog, ledger, explainer.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { Session } from "@supabase/supabase-js";
import { Globe, Palette, ShoppingBag, TrendingUp } from "lucide-react";
import WalletSlot from "./WalletSlot";

type Entry = { id: string; delta: number; kind: string; reason: string | null; created_at: string };

const CATALOG = [
  { icon: Palette, title: "Creative services", body: "Video, design, photography, music — booked straight from your dashboard.", range: "200–2,000 $RHOZE" },
  { icon: ShoppingBag, title: "Clothing purchases", body: "Rhozeland merch drops and limited collections.", range: "50–500 $RHOZE" },
  { icon: Globe, title: "Community access", body: "Exclusive events, group calls, and members-only content.", range: "25–300 $RHOZE" },
  { icon: TrendingUp, title: "Investments", body: "Back community projects and share in what they earn.", range: "100+ $RHOZE" },
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
  const month = entries.filter((e) => new Date(e.created_at).getTime() > since);
  const earnedMonth = month.filter((e) => e.delta > 0).reduce((a, e) => a + e.delta, 0);
  const spentMonth = month.filter((e) => e.delta < 0).reduce((a, e) => a + Math.abs(e.delta), 0);
  const earnedAll = entries.filter((e) => e.delta > 0).reduce((a, e) => a + e.delta, 0);

  return (
    <div className="space-y-4">
      <div className="grid lg:grid-cols-[340px_1fr] gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Current balance</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-4xl tabular-nums">{balance.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground mb-1">$RHOZE</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={() => window.open("/invest.html", "_blank")}>Buy $RHOZE</Button>
            <Button variant="outline" onClick={() => document.getElementById("rhoze-catalog")?.scrollIntoView({ behavior: "smooth" })}>
              Use $RHOZE
            </Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Stat label="Earned this month" value={`+${earnedMonth.toLocaleString()}`} />
          <Stat label="Spent this month" value={`−${spentMonth.toLocaleString()}`} />
          <Stat label="Total earned (all-time)" value={earnedAll.toLocaleString()} />
        </div>
      </div>

      <WalletSlot session={session} />

      <section id="rhoze-catalog">
        <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground mb-2">What can you use $RHOZE for?</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CATALOG.map((c) => (
            <div key={c.title} className="rounded-2xl border border-border bg-card p-4">
              <span className="w-9 h-9 rounded-lg bg-muted grid place-items-center"><c.icon className="w-4 h-4" /></span>
              <div className="mt-3 text-sm font-medium">{c.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{c.body}</p>
              <div className="mt-2 text-xs tabular-nums text-muted-foreground">{c.range}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_320px] gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Recent activity</div>
          {entries.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No token activity yet.</p>
          ) : (
            <div className="mt-2 divide-y divide-border">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate">{e.reason ?? e.kind}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {e.delta > 0 ? "Earned" : "Spent"} · {new Date(e.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`tabular-nums ${e.delta > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {e.delta > 0 ? "+" : "−"}{Math.abs(e.delta).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">What is $RHOZE?</div>
          <div className="mt-2 text-sm font-medium">Community currency</div>
          <p className="mt-1 text-sm text-muted-foreground">
            $RHOZE is the token that powers Rhozeland — earned on milestones, spent on services and merch,
            and shared across the community. You never need a wallet to use it; buying more is optional.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl tabular-nums">{value}</div>
    </div>
  );
}
