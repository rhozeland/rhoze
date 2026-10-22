// Studio call availability (Eastern Time). Mirrors the original booking page.
export const CALL_TZ = "America/New_York";
export const SLOT_MINUTES = 20;
export const MIN_NOTICE_HOURS = 24;
export const MAX_DAYS_OUT = 30;
const WEEKDAY: [string, string][] = [["09:30", "11:00"], ["16:00", "19:30"]];
const WEEKEND: [string, string][] = [["09:00", "18:00"]];
export const AVAILABILITY: Record<number, [string, string][]> = { 0: WEEKEND, 1: WEEKDAY, 2: WEEKDAY, 3: WEEKDAY, 4: WEEKDAY, 5: WEEKDAY, 6: WEEKEND };

function offsetMin(d: Date) {
  const p: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", { timeZone: CALL_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    .formatToParts(d).forEach((x) => { if (x.type !== "literal") p[x.type] = x.value; });
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - d.getTime()) / 60000;
}
export function etToUtc(y: number, m: number, d: number, h: number, min: number) {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  let utc = new Date(guess.getTime() - offsetMin(guess) * 60000);
  const off2 = offsetMin(utc);
  utc = new Date(guess.getTime() - off2 * 60000);
  return utc;
}
export const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: CALL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const dow = (key: string) => new Date(key + "T12:00:00Z").getUTCDay();

/** Upcoming bookable days as YYYY-MM-DD keys (ET). */
export function callDays(now = new Date()) {
  const out: string[] = [];
  for (let i = 0; i <= MAX_DAYS_OUT; i++) {
    const k = dayKey(new Date(now.getTime() + i * 86400000));
    if (!out.includes(k) && slotsForDay(k, [], now).length) out.push(k);
  }
  return out;
}

/** Free 20-minute slot starts for an ET day, excluding busy starts and anything under 24h notice. */
export function slotsForDay(key: string, busy: string[], now = new Date()) {
  const [y, m, d] = key.split("-").map(Number);
  const min = now.getTime() + MIN_NOTICE_HOURS * 3600000;
  const taken = new Set(busy.map((b) => new Date(b).getTime()));
  const slots: Date[] = [];
  for (const [s, e] of AVAILABILITY[dow(key)] || []) {
    const [sh, sm] = s.split(":").map(Number), [eh, em] = e.split(":").map(Number);
    for (let t = sh * 60 + sm; t + SLOT_MINUTES <= eh * 60 + em; t += SLOT_MINUTES) {
      const u = etToUtc(y, m, d, Math.floor(t / 60), t % 60);
      if (u.getTime() >= min && !taken.has(u.getTime())) slots.push(u);
    }
  }
  return slots;
}

export const canPayWithCredits = (balance: number, cost: number) => balance >= cost && cost > 0;
export const fmtSlot = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: CALL_TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(d);
export const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: CALL_TZ, hour: "numeric", minute: "2-digit" }).format(d);
export const fmtDay = (k: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(k + "T12:00:00Z"));
