// Team-only admin console for the ICO investor pledge campaign.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/team/lib/auth";

type Pledge = any;

export default function InvestAdmin() {
  const { isTeam } = useAuth();
  const [campaign, setCampaign] = useState<any>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fulfilling, setFulfilling] = useState<Pledge | null>(null);

  const load = async () => {
    const [c, p] = await Promise.all([
      supabase.from("campaign_state").select("*").eq("id", 1).maybeSingle(),
      supabase.from("investor_pledges").select("*").order("created_at", { ascending: false }),
    ]);
    setCampaign(c.data);
    setPledges(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => statusFilter === "all" ? pledges : pledges.filter((p) => p.status === statusFilter),
    [pledges, statusFilter],
  );

  const totals = useMemo(() => {
    const paid = pledges.filter((p) => ["confirmed", "settled", "fulfilled"].includes(p.status));
    return {
      raised: paid.reduce((a, p) => a + Number(p.amount_usd_cents), 0),
      fees: paid.reduce((a, p) => a + Number(p.service_fee_cents), 0),
      cohort: new Set(paid.map((p) => p.user_id)).size,
      pending: pledges.filter((p) => p.status === "pending").length,
    };
  }, [pledges]);

  const updateStatus = async (id: string, status: string) => {
    const patch: any = { status };
    if (status === "settled") patch.settled_at = new Date().toISOString();
    const { error } = await supabase.from("investor_pledges").update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else load();
  };

  const saveCampaign = async () => {
    const { error } = await supabase.from("campaign_state").update({
      remaining_sol: Number(campaign.remaining_sol),
      sol_price_usd: Number(campaign.sol_price_usd),
      total_target_sol: Number(campaign.total_target_sol),
      campaign_open: !!campaign.campaign_open,
      headline: campaign.headline,
      subhead: campaign.subhead,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Campaign updated" });
  };

  if (!isTeam) return <div className="p-8 text-sm text-muted-foreground">Team only.</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">Cohort ops</div>
        <h1 className="text-2xl tracking-tight">Investor pledges</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Raised" value={`$${(totals.raised / 100).toLocaleString()}`} />
        <Stat label="Fees earned" value={`$${(totals.fees / 100).toLocaleString()}`} />
        <Stat label="Cohort size" value={String(totals.cohort)} />
        <Stat label="Pending review" value={String(totals.pending)} />
      </div>

      {/* Campaign controls */}
      {campaign && (
        <div className="rounded-2xl border border-border p-5 space-y-3">
          <div className="text-sm font-medium">Campaign state (public)</div>
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Remaining SOL</Label>
              <Input type="number" step="0.01" value={campaign.remaining_sol}
                onChange={(e) => setCampaign({ ...campaign, remaining_sol: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Target SOL</Label>
              <Input type="number" step="0.01" value={campaign.total_target_sol}
                onChange={(e) => setCampaign({ ...campaign, total_target_sol: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">SOL price (USD)</Label>
              <Input type="number" step="0.01" value={campaign.sol_price_usd}
                onChange={(e) => setCampaign({ ...campaign, sol_price_usd: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Campaign open</Label>
              <Select value={campaign.campaign_open ? "1" : "0"} onValueChange={(v) => setCampaign({ ...campaign, campaign_open: v === "1" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Open</SelectItem>
                  <SelectItem value="0">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Headline</Label>
              <Input value={campaign.headline ?? ""} onChange={(e) => setCampaign({ ...campaign, headline: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Subhead</Label>
              <Input value={campaign.subhead ?? ""} onChange={(e) => setCampaign({ ...campaign, subhead: e.target.value })} />
            </div>
          </div>
          <Button size="sm" onClick={saveCampaign}>Save campaign</Button>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Filter</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="settled">Settled</SelectItem>
            <SelectItem value="fulfilled">Fulfilled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Tier</th>
              <th className="text-left px-3 py-2">Lock</th>
              <th className="text-left px-3 py-2">Path</th>
              <th className="text-left px-3 py-2">Pay</th>
              <th className="text-left px-3 py-2">Fee</th>
              <th className="text-left px-3 py-2">Multi</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-xs">{p.user_id.slice(0, 8)}…</td>
                <td className="px-3 py-2 tabular-nums">${(p.amount_usd_cents / 100).toLocaleString()}</td>
                <td className="px-3 py-2 capitalize">{p.tier}</td>
                <td className="px-3 py-2">{p.lock_months || "—"}</td>
                <td className="px-3 py-2 capitalize">{p.path}</td>
                <td className="px-3 py-2 capitalize">{p.payment_method}</td>
                <td className="px-3 py-2 tabular-nums">${(p.service_fee_cents / 100).toLocaleString()}</td>
                <td className="px-3 py-2 tabular-nums">{Number(p.credit_multiplier).toFixed(2)}×</td>
                <td className="px-3 py-2">
                  <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="settled">Settled</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  {p.status !== "fulfilled" && (
                    <Button size="sm" variant="outline" onClick={() => setFulfilling(p)}>Fulfill</Button>
                  )}
                  {p.status === "fulfilled" && (
                    <span className="text-xs text-muted-foreground">
                      {Number(p.credits_awarded).toLocaleString()} credits
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-sm text-muted-foreground">No pledges match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <FulfillDialog pledge={fulfilling} onClose={() => setFulfilling(null)} onDone={load} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="text-[11px] tracking-[0.25em] uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl tabular-nums mt-1">{value}</div>
    </div>
  );
}

function FulfillDialog({ pledge, onClose, onDone }: { pledge: any; onClose: () => void; onDone: () => void }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [tx, setTx] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pledge) return;
    (async () => {
      const { data } = await supabase.from("projects")
        .select("id, title, client_email")
        .order("created_at", { ascending: false }).limit(200);
      setProjects(data ?? []);
      setProjectId("");
      setTx("");
    })();
  }, [pledge?.id]);

  const fulfill = async () => {
    if (!projectId) { toast({ title: "Pick a project to receive credits" }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_fulfill_investor_pledge", {
      _pledge_id: pledge.id,
      _project_id: projectId,
      _tx_signature: tx.trim() || null,
    });
    setBusy(false);
    if (error) { toast({ title: "Fulfill failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Pledge fulfilled + credits issued" });
    onDone(); onClose();
  };

  return (
    <Dialog open={!!pledge} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fulfill pledge</DialogTitle>
        </DialogHeader>
        {pledge && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              ${(pledge.amount_usd_cents / 100).toLocaleString()} · {pledge.tier} · {pledge.credit_multiplier}×
              → <span className="text-foreground">
                {Math.floor((pledge.amount_usd_cents / 100) * Number(pledge.credit_multiplier)).toLocaleString()} credits
              </span>
            </div>
            <div>
              <Label className="text-xs">Award credits to project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Pick project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.title} · {p.client_email ?? "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tx signature (optional)</Label>
              <Input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Solana tx sig" />
            </div>
            <Button className="w-full" disabled={busy} onClick={fulfill}>
              {busy ? "…" : "Fulfill + issue credits"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}