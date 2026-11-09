import jsPDF from "jspdf";
import { formatCents, formatDate } from "./format";

type StubLike = {
  gross_cents: number; vacation_cents: number; cpp_cents: number; cpp2_cents: number;
  ei_cents: number; fed_tax_cents: number; prov_tax_cents: number; deductions_cents: number;
  net_cents: number; expense_cents: number; hourly_cents: number; flat_cents: number;
  revshare_cents: number; employer_cpp_cents?: number; employer_ei_cents?: number; worker_type: string; province: string; pay_frequency: number;
  paid_at?: string | null; paid_method?: string | null; paid_reference?: string | null;
  ytd?: any; breakdown?: any;
};

export function buildPayStubPdf(opts: {
  stub: StubLike;
  person: { name: string; email?: string | null };
  period: { label: string; start_date: string; end_date: string; pay_date: string };
  employer?: { name: string; address?: string };
}) {
  const { stub, person, period } = opts;
  const employer = opts.employer ?? { name: "Rhozeland Collaboration Inc.", address: "Toronto, Ontario, Canada" };
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  const line = (yy: number) => { doc.setDrawColor(210); doc.line(M, yy, W - M, yy); };
  const label = (t: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(120);
    doc.text(t.toUpperCase(), x, yy);
  };
  const value = (t: string, x: number, yy: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(10); doc.setTextColor(20);
    doc.text(t, x, yy);
  };
  const money = (t: string, yy: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(10); doc.setTextColor(20);
    doc.text(t, W - M, yy, { align: "right" });
  };
  const row = (name: string, amountCents: number, bold = false) => {
    value(name, M, y, bold); money(formatCents(amountCents), y, bold); y += 16;
  };
  const heading = (t: string) => {
    y += 6; doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(t.toUpperCase(), M, y); y += 6; line(y); y += 14;
  };

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(20);
  doc.text(employer.name, M, y);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("STATEMENT OF EARNINGS", W - M, y, { align: "right" });
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
  if (employer.address) doc.text(employer.address, M, y);
  doc.text(stub.paid_at ? `Paid ${formatDate(stub.paid_at)}` : "Not yet paid", W - M, y, { align: "right" });
  y += 16; line(y); y += 20;

  // Employee / period block
  label("Paid to", M, y); label("Pay period", M + 200, y); label("Pay date", M + 360, y);
  y += 13;
  value(person.name, M, y, true);
  value(`${formatDate(period.start_date)} – ${formatDate(period.end_date)}`, M + 200, y);
  value(formatDate(period.pay_date), M + 360, y);
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
  if (person.email) doc.text(person.email, M, y);
  doc.text(
    `${stub.worker_type === "employee" ? "Employee" : "Contractor"} · ${stub.province} · ${stub.pay_frequency} pay periods/yr`,
    M + 200, y,
  );
  y += 10; line(y); y += 8;

  // QuickBooks-style tables: Description | Hours | Rate | Current | YTD
  const ytd = stub.ytd || {};
  const cols = { hours: W - M - 250, rate: W - M - 175, cur: W - M - 85, ytd: W - M };
  const th = (title: string, withHours = false) => {
    y += 6; doc.setFillColor(238, 238, 238); doc.rect(M, y - 10, W - M * 2, 16, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(60);
    doc.text(title.toUpperCase(), M + 6, y);
    if (withHours) { doc.text("HOURS", cols.hours, y, { align: "right" }); doc.text("RATE", cols.rate, y, { align: "right" }); }
    doc.text("CURRENT", cols.cur, y, { align: "right" }); doc.text("YTD", cols.ytd - 6, y, { align: "right" });
    y += 16;
  };
  const tr = (name: string, cur: number, ytdVal?: number | null, bold = false, hours?: number | null, rate?: number | null) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9); doc.setTextColor(20);
    doc.text(name, M + 6, y, { maxWidth: cols.hours - M - 60 });
    if (hours != null) doc.text(hours.toFixed(2), cols.hours, y, { align: "right" });
    if (rate != null) doc.text(formatCents(rate), cols.rate, y, { align: "right" });
    doc.text(formatCents(cur), cols.cur, y, { align: "right" });
    if (ytdVal != null) doc.text(formatCents(ytdVal), cols.ytd - 6, y, { align: "right" });
    y += 14;
  };
  const bd = stub.breakdown || {};

  th("Earnings", true);
  const hourly: any[] = bd.hourly_lines || [];
  if (hourly.length) hourly.forEach((l) => tr(l.deliverable || (l.type === "specialist" ? "Specialist hours" : "Regular pay"), l.amount_cents, null, false, Number(l.hours) || 0, l.rate_cents));
  else if (stub.hourly_cents) tr("Regular pay", stub.hourly_cents);
  const flats: any[] = bd.flat_lines || [];
  if (flats.length) flats.forEach((l) => tr(l.deliverable || "Flat-fee deliverable", l.amount_cents));
  else if (stub.flat_cents) tr("Flat-fee deliverables", stub.flat_cents);
  if (stub.revshare_cents) tr("Revenue share", stub.revshare_cents);
  if (stub.vacation_cents) tr("Vacation pay", stub.vacation_cents);
  line(y - 8); tr("Gross pay", stub.gross_cents, ytd.gross_cents ?? null, true);

  if (stub.worker_type === "employee") {
    th("Statutory deductions");
    tr("Canada Pension Plan (CPP)", stub.cpp_cents, ytd.cpp_cents ?? null);
    if (stub.cpp2_cents || ytd.cpp2_cents) tr("Second CPP (CPP2)", stub.cpp2_cents, ytd.cpp2_cents ?? null);
    tr("Employment Insurance (EI)", stub.ei_cents, ytd.ei_cents ?? null);
    tr("Federal income tax", stub.fed_tax_cents, ytd.fed_tax_cents ?? null);
    tr(stub.province === "ON" ? "Ontario income tax (incl. health premium)" : `Provincial income tax (${stub.province})`, stub.prov_tax_cents, ytd.prov_tax_cents ?? null);
    line(y - 8); tr("Total deductions", stub.deductions_cents, ytd.gross_cents != null && ytd.net_cents != null ? ytd.gross_cents - ytd.net_cents : null, true);
  } else {
    y += 6; doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120);
    doc.text("Contractor — no source deductions withheld. You are responsible for your own remittances.", M, y); y += 16;
  }

  if (stub.expense_cents) { th("Non-taxable reimbursements"); tr("Expense reimbursement", stub.expense_cents); }

  // Net pay
  y += 8; doc.setFillColor(20, 20, 20); doc.rect(M, y - 4, W - M * 2, 28, "F");
  y += 14; doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("NET PAY", M + 10, y);
  doc.setFontSize(12); doc.text(formatCents(stub.net_cents), cols.cur, y, { align: "right" });
  doc.setFontSize(9); if (ytd.net_cents != null) doc.text(formatCents(ytd.net_cents), cols.ytd - 6, y, { align: "right" });
  doc.setTextColor(20); y += 26;

  if (stub.worker_type === "employee" && (stub.employer_cpp_cents || stub.employer_ei_cents)) {
    th("Employer contributions (not deducted from your pay)");
    tr("Employer CPP", stub.employer_cpp_cents || 0);
    tr("Employer EI", stub.employer_ei_cents || 0);
  }
  y += 4;

  if (stub.paid_at) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
    doc.text(
      `Payment method: ${stub.paid_method || "—"}${stub.paid_reference ? ` · Ref ${stub.paid_reference}` : ""}`,
      M, y,
    );
    y += 14;
  }

  doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(150);
  doc.text(
    "Generated by the Rhozeland payroll system. Deduction amounts are calculated using CRA formulas for the current tax year.",
    M, doc.internal.pageSize.getHeight() - 40, { maxWidth: W - M * 2 },
  );

  return doc;
}

export function downloadPayStub(args: Parameters<typeof buildPayStubPdf>[0]) {
  const doc = buildPayStubPdf(args);
  const safe = args.person.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`paystub-${safe}-${args.period.pay_date}.pdf`);
}
