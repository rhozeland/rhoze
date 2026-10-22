import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarCheck } from "lucide-react";
import { callDays, slotsForDay, fmtDay, fmtTime, fmtSlot, canPayWithCredits } from "./call-slots";

export type CallChoice = { slot: string; pay: boolean } | null;

/** Optional "Book a call" step: pick a slot, optionally pay with credits. */
export default function BookCallStep({ choice, onChoice, booked }: { choice: CallChoice; onChoice: (c: CallChoice) => void; booked: string | null }) {
  const days = useMemo(() => callDays(), []);
  const [day, setDay] = useState(() => (choice ? days.find((d) => slotsForDay(d, []).some((s) => s.toISOString() === choice.slot)) : null) || days[0]);
  const [busy, setBusy] = useState<string[]>([]);
  const [credits, setCredits] = useState<{ balance: number; cost: number } | null>(null);
  useEffect(() => {
    supabase.rpc("list_busy_slots").then(({ data }) => setBusy((data || []).map((b: any) => b.slot_start)));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) (supabase.rpc as any)("my_call_credits").then(({ data }: any) => { const r = data?.[0]; if (r) setCredits({ balance: Number(r.balance_credits), cost: r.call_cost }); });
    });
  }, []);
  const slots = day ? slotsForDay(day, busy) : [];
  const canPay = credits ? canPayWithCredits(credits.balance, credits.cost) : false;

  if (booked) return (
    <div className="rz-split" style={{ marginBottom: ".9rem" }}>
      <div className="rz-split-row" style={{ gridTemplateColumns: "auto 1fr" }}><CalendarCheck size={16} /><b>Call booked · {fmtSlot(new Date(booked))}</b></div>
    </div>
  );

  return (
    <>
      <div className="rz-head"><h1>Book a call <span className="rz-opt">(optional)</span></h1><p>Pick a 20-minute time with the Rhozeland team, or skip and book later.</p></div>
      <div style={{ display: "flex", gap: ".35rem", overflowX: "auto", paddingBottom: ".4rem", marginBottom: ".6rem" }}>
        {days.map((d) => <Button key={d} variant="outline" className={`rz-btn${d === day ? " pri" : ""}`} style={{ flex: "0 0 auto" }} onClick={() => setDay(d)}>{fmtDay(d)}</Button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(6.5rem,1fr))", gap: ".35rem", marginBottom: ".9rem" }}>
        {slots.length ? slots.map((s) => { const iso = s.toISOString(); const on = choice?.slot === iso; return (
          <Button key={iso} variant="outline" className={`rz-btn${on ? " pri" : ""}`} aria-pressed={on} onClick={() => onChoice(on ? null : { slot: iso, pay: choice?.pay ?? false })}>{fmtTime(s)}</Button>
        ); }) : <span className="rz-opt">No open times this day.</span>}
      </div>
      <div className="rz-split" style={{ marginBottom: ".9rem" }}>
        <div className="rz-split-row" style={{ gridTemplateColumns: "1fr auto" }}><span>Call cost</span><b>{credits ? `${credits.cost} credit` : "1 credit"}</b></div>
        <div className="rz-split-row" style={{ gridTemplateColumns: "1fr auto" }}><span>Your credit balance</span><b>{credits ? `${credits.balance} credit${credits.balance === 1 ? "" : "s"}` : "Sign in to see"}</b></div>
        <label className="rz-split-row" style={{ gridTemplateColumns: "auto 1fr", cursor: canPay ? "pointer" : "default", opacity: canPay || !credits ? 1 : .55 }}>
          <input type="checkbox" disabled={!!credits && !canPay} checked={!!choice?.pay} onChange={(e) => choice && onChoice({ ...choice, pay: e.target.checked })} />
          <span>Pay with credits{credits && !canPay ? " (not enough credits — the call stays free to book)" : ""}</span>
        </label>
      </div>
      {choice && <p className="rz-note">Selected: {fmtSlot(new Date(choice.slot))}. You'll need an account to confirm.</p>}
    </>
  );
}
