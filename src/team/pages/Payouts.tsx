import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { id: string; recipient_name: string; recipient_email: string | null; amount_cents: number; status: string; reference: string | null; created_at: string; releases: { title: string } | null; release_milestones: { title: string } | null };
const fmt = (c: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(c / 100);

/** Admin queue: approved milestone payouts Rhozeland sends by e-transfer or bank, then marks sent. */
export default function Payouts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const load = () => supabase.from("release_payouts").select("id,recipient_name,recipient_email,amount_cents,status,reference,created_at,releases(title),release_milestones(title)").order("created_at", { ascending: false }).then(({ data }) => setRows((data as any) || []));
  useEffect(() => { load(); }, []);
  const markSent = async (id: string) => {
    setErr("");
    const { error } = await (supabase.rpc as any)("admin_mark_payout_sent", { p_payout_id: id, p_reference: refs[id] || "" });
    if (error) setErr("Couldn't mark this payout as sent."); else load();
  };
  const pending = rows.filter((r) => r.status === "pending");
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Collaborator payouts</h1>
      <p className="text-sm text-muted-foreground">{pending.length} waiting · {fmt(pending.reduce((s, r) => s + r.amount_cents, 0))} to send. Send by e-transfer or bank, then mark sent.</p>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="divide-y rounded-lg border">
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No payouts yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <div className="min-w-[14rem] flex-1">
              <div className="font-medium">{r.recipient_name} · {fmt(r.amount_cents)}</div>
              <div className="text-muted-foreground">{r.releases?.title} — {r.release_milestones?.title} {r.recipient_email ? `· ${r.recipient_email}` : ""}</div>
            </div>
            {r.status === "pending" ? (
              <>
                <Input className="w-48" placeholder="Reference (optional)" value={refs[r.id] || ""} onChange={(e) => setRefs({ ...refs, [r.id]: e.target.value })} />
                <Button size="sm" onClick={() => markSent(r.id)}>Mark sent</Button>
              </>
            ) : <span className="text-muted-foreground">Sent{r.reference ? ` · ${r.reference}` : ""}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
