import { useEffect, useState } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { money } from "./shared";
import { buildIcs, payoutPreview, STATUS_LABEL } from "./payments-logic";

type Ms = { id: string; position: number; title: string; amount_cents: number; due_date: string | null; status: string; assignees: { member_id: string; pct: number }[] };
type Member = { id: string; display_name: string; email: string | null };
type Payout = { id: string; milestone_id: string; recipient_name: string; amount_cents: number; status: string; reference: string | null };

/** Owner payments: deposit + per-milestone checkout, collaborator shares, approval → payouts Rhozeland sends manually, and a schedule. */
export default function ProjectPayments({ r }: { r: any }) {
  const [ms, setMs] = useState<Ms[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [paying, setPaying] = useState<Ms | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fee = Number(r.fee_pct) || 0;

  const load = async () => {
    const [{ data: rows, error }, { data: team }, { data: po }] = await Promise.all([
      (supabase.rpc as any)("release_sync_milestones", { p_id: r.id }),
      supabase.from("release_team_members").select("id,display_name,email").eq("release_id", r.id),
      supabase.from("release_payouts").select("id,milestone_id,recipient_name,amount_cents,status,reference").eq("release_id", r.id),
    ]);
    if (error) setMsg("Couldn't load payments. Save your roadmap and try again.");
    setMs(rows || []); setMembers((team as Member[]) || []); setPayouts((po as Payout[]) || []);
    return rows as Ms[] | null;
  };

  useEffect(() => {
    load().then(() => {
      if (new URLSearchParams(location.search).get("paid") === "1") {
        setMsg("Payment received — confirming…");
        let n = 0;
        const t = setInterval(async () => { n++; await load(); if (n >= 5) { clearInterval(t); setMsg(""); } }, 3000);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  const patch = (id: string, p: Partial<Ms>) => setMs((all) => all.map((m) => (m.id === id ? { ...m, ...p } : m)));
  const toggle = (m: Ms, memberId: string) => {
    const has = m.assignees.some((a) => a.member_id === memberId);
    const next = has ? m.assignees.filter((a) => a.member_id !== memberId) : [...m.assignees, { member_id: memberId, pct: 0 }];
    const even = next.length ? Math.floor(100 / next.length) : 0;
    patch(m.id, { assignees: next.map((a, i) => ({ ...a, pct: i === 0 ? 100 - even * (next.length - 1) : even })) });
  };

  const savePlan = async (m: Ms) => {
    setBusy(true); setMsg("");
    const { error } = await (supabase.rpc as any)("release_set_milestone_plan", { p_milestone_id: m.id, p_due_date: m.due_date || null, p_assignees: m.assignees });
    setBusy(false);
    setMsg(error ? (error.message.includes("100") ? "Shares must add up to 100%." : "Couldn't save this milestone.") : "Milestone saved.");
  };
  const approve = async (m: Ms) => {
    if (!confirm(`Approve "${m.title || "this milestone"}"? This tells Rhozeland to pay the assigned collaborators.`)) return;
    setBusy(true);
    const { error } = await (supabase.rpc as any)("release_approve_milestone", { p_milestone_id: m.id });
    setBusy(false);
    setMsg(error ? (error.message.includes("assign") ? "Assign collaborators and save before approving." : "Couldn't approve this milestone.") : "Approved — payouts are queued for Rhozeland.");
    load();
  };
  const fetchClientSecret = async () => {
    const { data, error } = await supabase.functions.invoke("release-checkout", {
      body: { milestoneId: paying!.id, environment: getStripeEnvironment(), returnUrl: `${location.origin}/workspace/${r.id}?paid=1` },
    });
    if (error || !data?.clientSecret) throw new Error(data?.error || "Couldn't start checkout");
    return data.clientSecret as string;
  };
  const downloadIcs = () => {
    const blob = new Blob([buildIcs(r.title || "Project", ms)], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "project-schedule.ics"; a.click();
  };

  if (!ms.length) return <p className="rz-ws-note">Add milestones with budgets in the Roadmap tab and save, then set up payments here.</p>;
  const nextPayable = ms.find((m) => m.status === "planned");
  const dated = ms.filter((m) => m.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  return (
    <div className="rz-pay">
      <p className="rz-ws-note">Pay a deposit (milestone 1), then each milestone. When you approve finished work, Rhozeland pays the collaborators you assigned{fee ? `, after its ${fee}% fee` : ""}.</p>
      {ms.map((m) => {
        const locked = m.status === "approved" || m.status === "paid";
        const mp = payouts.filter((p) => p.milestone_id === m.id);
        return (
          <div className="rz-pay-card" key={m.id}>
            <div className="rz-pay-head">
              <strong>{m.position === 0 ? "Deposit · " : ""}{m.title || `Milestone ${m.position + 1}`}</strong>
              <span>{money(m.amount_cents)}</span>
              <span className={`rz-pay-status s-${m.status}`}>{STATUS_LABEL[m.status]}</span>
            </div>
            <label className="rz-pay-row">Due date<input className="rz-in" type="date" disabled={locked} value={m.due_date || ""} onChange={(e) => patch(m.id, { due_date: e.target.value || null })} /></label>
            {members.length === 0 ? <p className="rz-ws-note">Add people in the People tab to assign them.</p> : (
              <div className="rz-pay-people">
                {members.map((p) => {
                  const a = m.assignees.find((x) => x.member_id === p.id);
                  return (
                    <div className="rz-pay-person" key={p.id}>
                      <label><input type="checkbox" disabled={locked} checked={!!a} onChange={() => toggle(m, p.id)} />{p.display_name}</label>
                      {a && <><input className="rz-in" type="number" min={0} max={100} disabled={locked} value={a.pct} aria-label={`${p.display_name} share %`}
                        onChange={(e) => patch(m.id, { assignees: m.assignees.map((x) => (x.member_id === p.id ? { ...x, pct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x)) })} />%
                        <span className="rz-ws-note">≈ {money(payoutPreview(m.amount_cents, fee, a.pct))}</span></>}
                    </div>
                  );
                })}
              </div>
            )}
            {mp.length > 0 && <ul className="rz-pay-payouts">{mp.map((p) => <li key={p.id}>{p.recipient_name} · {money(p.amount_cents)} · {p.status === "sent" ? `Sent${p.reference ? ` (${p.reference})` : ""}` : "Waiting for Rhozeland"}</li>)}</ul>}
            <div className="rz-ws-save">
              {!locked && <Button variant="outline" className="rz-btn" disabled={busy} onClick={() => savePlan(m)}>Save</Button>}
              {m.status === "planned" && <Button variant="outline" className="rz-btn pri" disabled={busy || nextPayable?.id !== m.id || m.amount_cents < 100} onClick={() => setPaying(m)}>{m.position === 0 ? "Pay deposit" : "Pay milestone"}</Button>}
              {m.status === "funded" && <Button variant="outline" className="rz-btn pri" disabled={busy} onClick={() => approve(m)}>Approve work</Button>}
            </div>
          </div>
        );
      })}

      <div className="rz-pay-card">
        <div className="rz-pay-head"><strong>Schedule</strong></div>
        {dated.length ? <ul className="rz-pay-payouts">{dated.map((m) => <li key={m.id}>{new Date(m.due_date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} — {m.title || `Milestone ${m.position + 1}`}</li>)}</ul>
          : <p className="rz-ws-note">Set due dates above to build the schedule.</p>}
        {dated.length > 0 && <Button variant="outline" className="rz-btn" onClick={downloadIcs}>Add to calendar (Google, Apple, Outlook)</Button>}
      </div>
      {msg && <p className="rz-note">{msg}</p>}

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="max-w-xl">
          <DialogTitle>{paying?.position === 0 ? "Pay deposit" : "Pay milestone"} · {paying && money(paying.amount_cents)}</DialogTitle>
          {paying && <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
