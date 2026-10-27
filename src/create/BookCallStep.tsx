import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarCheck } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import "./book-call.css";
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

  const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const toDate = (k: string) => { const [y, m, dd] = k.split("-").map(Number); return new Date(y, m - 1, dd); };
  const open = new Set(days.filter((d) => slotsForDay(d, busy).length));
  const hourOf = (s: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(s));
  const groups = ([["Morning", (h: number) => h < 12], ["Afternoon", (h: number) => h >= 12 && h < 17], ["Evening", (h: number) => h >= 17]] as const)
    .map(([label, test]) => [label, slots.filter((s) => test(hourOf(s)))] as const).filter(([, list]) => list.length);
  return (
    <>
      <div className="rz-head"><h1>Book a call <span className="rz-opt">(optional)</span></h1><p>Pick a day, then a 20-minute time with the Rhozeland team. Or skip and book later.</p></div>
      <div className="rz-book">
        <div className="rz-book-cal">
          <Calendar mode="single" selected={day ? toDate(day) : undefined} onSelect={(d) => d && setDay(keyOf(d))}
            fromDate={toDate(days[0])} toDate={toDate(days[days.length - 1])} disabled={(d) => !open.has(keyOf(d))} className="p-3 pointer-events-auto" />
        </div>
        <div className="rz-book-times">
          <p className="rz-book-day">{day ? fmtDay(day) : "Pick a day"}<span>Eastern time</span></p>
          {groups.length ? groups.map(([label, list]) => <div key={label} className="rz-book-group"><span>{label}</span><div>
            {list.map((s) => { const iso = s.toISOString(); const on = choice?.slot === iso; return (
              <button type="button" key={iso} className={`rz-book-slot${on ? " on" : ""}`} aria-pressed={on} onClick={() => onChoice(on ? null : { slot: iso, pay: choice?.pay ?? false })}>{fmtTime(s)}</button>
            ); })}</div></div>) : <span className="rz-opt">No open times this day.</span>}
        </div>
      </div>
      <label className="rz-book-pay" style={{ opacity: !credits || canPay ? 1 : .55 }}>
        <input type="checkbox" disabled={!choice || (!!credits && !canPay)} checked={!!choice?.pay} onChange={(e) => choice && onChoice({ ...choice, pay: e.target.checked })} />
        <span>Pay with {credits ? `${credits.cost} credit` : "1 credit"}<small>{credits ? `You have ${credits.balance}${!canPay ? " · not enough, the call stays free to book" : ""}` : "Sign in to see your balance"}</small></span>
      </label>
      {choice && <p className="rz-note">Selected: {fmtSlot(new Date(choice.slot))}. You'll need an account to confirm.</p>}
    </>
  );
}
