import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Wallet, Plus, ArrowRight, Send, Gift } from "lucide-react";
import { useAuth } from "../lib/auth";

type Settings = {
  earn_per_dollar: number;
  bonus_first_project: number;
  reward_event_attended: number;
  reward_referral: number;
  credit_cost_rhoze: number;
  max_discount_pct: number;
};
type Balance = {
  project_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  solana_wallet: string | null;
};
type LedgerRow = {
  id: string;
  delta: number;
  kind: string;
  reason: string | null;
  created_at: string;
};

const fmt = (n: number) => Number(n).toLocaleString();

export function RhozePanel({ projectId, mode }: { projectId: string; mode: "client" | "team" }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: settings } = useQuery<Settings>({
    queryKey: ["rhoze_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rhoze_settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as Settings;
    },
  });

  const { data: balance } = useQuery<Balance | null>({
    queryKey: ["rhoze_balance", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rhoze_balances")
        .select("project_id,balance,lifetime_earned,lifetime_spent,solana_wallet")
        .eq("project_id", projectId)
        .maybeSingle();
      return (data as Balance) ?? null;
    },
  });

  const { data: ledger } = useQuery<LedgerRow[]>({
    queryKey: ["rhoze_ledger", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rhoze_ledger")
        .select("id,delta,kind,reason,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(8);
      return (data as LedgerRow[]) ?? [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rhoze_balance", projectId] });
    qc.invalidateQueries({ queryKey: ["rhoze_ledger", projectId] });
  };

  const linkWallet = useMutation({
    mutationFn: async (wallet: string) => {
      const trimmed = wallet.trim();
      // Ensure row exists, then update
      await supabase.from("rhoze_balances").upsert({ project_id: projectId }, { onConflict: "project_id" });
      const { error } = await supabase
        .from("rhoze_balances")
        .update({ solana_wallet: trimmed || null })
        .eq("project_id", projectId);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Wallet linked" }); refresh(); },
    onError: (e: any) => toast({ title: "Could not link wallet", description: e.message, variant: "destructive" }),
  });

  const redeem = useMutation({
    mutationFn: async (credits: number) => {
      const { error } = await supabase.rpc("rhoze_redeem_for_credits", { _project_id: projectId, _credits: credits });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Credits added" }); refresh(); qc.invalidateQueries({ queryKey: ["portal_project", projectId] }); },
    onError: (e: any) => toast({ title: "Redeem failed", description: e.message, variant: "destructive" }),
  });

  const award = useMutation({
    mutationFn: async (vars: { amount: number; kind: string; reason?: string }) => {
      const { error } = await supabase.rpc("rhoze_award", {
        _project_id: projectId,
        _amount: vars.amount,
        _kind: vars.kind,
        _reason: vars.reason ?? null,
        _related_payment_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "$RHOZE awarded" }); refresh(); },
    onError: (e: any) => toast({ title: "Award failed", description: e.message, variant: "destructive" }),
  });

  const queueAirdrop = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase.rpc("rhoze_queue_airdrop", {
        _project_id: projectId,
        _amount: amount,
        _notes: null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Airdrop queued" }); refresh(); },
    onError: (e: any) => toast({ title: "Queue failed", description: e.message, variant: "destructive" }),
  });

  const bal = balance?.balance ?? 0;
  const per = settings?.credit_cost_rhoze ?? 600;
  const maxRedeemable = Math.floor(bal / per);
  const [credits, setCredits] = useState<number>(1);
  const [walletInput, setWalletInput] = useState<string>(balance?.solana_wallet ?? "");
  const [walletOpen, setWalletOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [airdropOpen, setAirdropOpen] = useState(false);

  const [awardKind, setAwardKind] = useState<string>("earn_event");
  const [awardAmount, setAwardAmount] = useState<string>(String(settings?.reward_event_attended ?? 250));
  const [awardReason, setAwardReason] = useState("");
  const [airdropAmount, setAirdropAmount] = useState<string>("");

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-fuchsia-500/10 via-primary/5 to-transparent p-5 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-fuchsia-500 dark:text-fuchsia-400" />
            <div className="text-xs uppercase tracking-wider text-muted-foreground">$RHOZE Rewards</div>
          </div>
          <div className="text-3xl font-semibold tabular-nums">
            {fmt(bal)} <span className="text-sm text-muted-foreground font-normal">$RHOZE</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Lifetime earned {fmt(balance?.lifetime_earned ?? 0)} · spent {fmt(balance?.lifetime_spent ?? 0)}
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground space-y-0.5 shrink-0">
          <div>Earn <span className="text-foreground font-medium">{settings?.earn_per_dollar ?? 10}</span>/$1 spent</div>
          <div>{per} $RHOZE = 1 credit</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={redeemOpen} onOpenChange={setRedeemOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={maxRedeemable < 1}>
              <ArrowRight size={14} /> Redeem for credits
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Redeem $RHOZE for credits</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="text-muted-foreground">
                Each credit costs <strong className="text-foreground">{per} $RHOZE</strong>. Your balance covers up to <strong className="text-foreground">{maxRedeemable}</strong> credits.
              </div>
              <div className="space-y-1.5">
                <Label>Credits</Label>
                <Input
                  type="number" min={1} max={maxRedeemable || 1}
                  value={credits}
                  onChange={(e) => setCredits(Math.max(1, Math.min(maxRedeemable || 1, parseInt(e.target.value || "1"))))}
                />
                <div className="text-xs text-muted-foreground">
                  Cost: <strong className="text-foreground">{fmt(credits * per)} $RHOZE</strong> → {credits} credit{credits === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => redeem.mutate(credits, { onSuccess: () => setRedeemOpen(false) })} disabled={redeem.isPending || credits < 1 || credits > maxRedeemable}>
                Redeem
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={walletOpen} onOpenChange={(v) => { setWalletOpen(v); if (v) setWalletInput(balance?.solana_wallet ?? ""); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Wallet size={14} /> {balance?.solana_wallet ? "Update wallet" : "Link wallet"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Link Solana wallet</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <Label>Wallet address</Label>
              <Input value={walletInput} onChange={(e) => setWalletInput(e.target.value)} placeholder="e.g. 7Np...x9F" />
              <p className="text-xs text-muted-foreground">
                We'll send your $RHOZE here when you request a payout. Use a wallet you control (Phantom, Solflare).
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => linkWallet.mutate(walletInput, { onSuccess: () => setWalletOpen(false) })}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {mode === "team" && (
          <>
            <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Gift size={14} /> Award</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Award $RHOZE</DialogTitle></DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="space-y-1.5">
                    <Label>Reason</Label>
                    <Select value={awardKind} onValueChange={(v) => {
                      setAwardKind(v);
                      if (v === "earn_event") setAwardAmount(String(settings?.reward_event_attended ?? 250));
                      else if (v === "earn_referral") setAwardAmount(String(settings?.reward_referral ?? 1000));
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="earn_event">Event attended</SelectItem>
                        <SelectItem value="earn_referral">Referral</SelectItem>
                        <SelectItem value="earn_adjust">Manual adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount ($RHOZE)</Label>
                    <Input type="number" min={1} value={awardAmount} onChange={(e) => setAwardAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input value={awardReason} onChange={(e) => setAwardReason(e.target.value)} placeholder="e.g. Saint Flair West showcase" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => award.mutate({ amount: parseInt(awardAmount || "0"), kind: awardKind, reason: awardReason || undefined }, { onSuccess: () => setAwardOpen(false) })} disabled={award.isPending}>
                    Award
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {isAdmin && (
              <Dialog open={airdropOpen} onOpenChange={setAirdropOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={!balance?.solana_wallet || bal <= 0}>
                    <Send size={14} /> Queue airdrop
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Queue $RHOZE airdrop</DialogTitle></DialogHeader>
                  <div className="space-y-3 text-sm">
                    <div className="text-muted-foreground">
                      Sends to <code className="text-foreground">{balance?.solana_wallet}</code>. Subtract from balance now; mark as sent after the on-chain transfer.
                    </div>
                    <div className="space-y-1.5">
                      <Label>Amount ($RHOZE) — max {fmt(bal)}</Label>
                      <Input type="number" min={1} max={bal} value={airdropAmount} onChange={(e) => setAirdropAmount(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => queueAirdrop.mutate(parseInt(airdropAmount || "0"), { onSuccess: () => setAirdropOpen(false) })} disabled={queueAirdrop.isPending}>
                      Queue
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </div>

      {/* Wallet status pill */}
      {balance?.solana_wallet ? (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Wallet size={11} /> Linked: <code className="text-foreground">{balance.solana_wallet.slice(0, 6)}…{balance.solana_wallet.slice(-4)}</code>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">
          Link a Solana wallet to receive on-chain payouts.
        </div>
      )}

      {/* Recent ledger */}
      {(ledger ?? []).length > 0 && (
        <div className="border-t border-border pt-3 space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent activity</div>
          <ul className="space-y-1">
            {ledger!.map((row) => (
              <li key={row.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted-foreground truncate">
                  {row.reason || row.kind.replace(/_/g, " ")}
                </span>
                <span className={`tabular-nums font-medium shrink-0 ${row.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-fuchsia-500 dark:text-fuchsia-400"}`}>
                  {row.delta >= 0 ? "+" : ""}{fmt(row.delta)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
