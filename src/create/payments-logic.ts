export const STATUS_LABEL: Record<string, string> = { planned: "Not paid", funded: "Paid · in progress", approved: "Approved · payout pending", paid: "Collaborators paid" };

/** Collaborator's share of a milestone after Rhozeland's fee, in cents (rounded down, matching the database). */
export function payoutPreview(amountCents: number, feePct: number, sharePct: number) {
  return Math.floor((amountCents * (100 - feePct)) / 100 * sharePct / 100);
}

/** All-day calendar events for milestones with due dates. DTEND is exclusive (next day). */
export function buildIcs(title: string, ms: { id: string; title: string; position: number; due_date: string | null }[]) {
  const d = (s: string) => s.replace(/-/g, "");
  const next = (s: string) => { const [y, m, dd] = s.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, dd + 1)); return t.toISOString().slice(0, 10).replace(/-/g, ""); };
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  const ev = ms.filter((m) => m.due_date).map((m) => [
    "BEGIN:VEVENT", `UID:${m.id}@rhozeland.com`, `DTSTART;VALUE=DATE:${d(m.due_date!)}`, `DTEND;VALUE=DATE:${next(m.due_date!)}`,
    `SUMMARY:${esc(`${title}: ${m.title || `Milestone ${m.position + 1}`}`)}`, "END:VEVENT",
  ].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rhozeland//Projects//EN", ...ev, "END:VCALENDAR"].join("\r\n");
}
