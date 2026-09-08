import jsPDF from "jspdf";
import { formatCents, formatDate } from "./format";

type StubLike = {
  gross_cents: number; vacation_cents: number; cpp_cents: number; cpp2_cents: number;
  ei_cents: number; fed_tax_cents: number; prov_tax_cents: number; deductions_cents: number;
  net_cents: number; expense_cents: number; hourly_cents: number; flat_cents: number;
  revshare_cents: number; worker_type: string; province: string; pay_frequency: number;
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

  // Earnings
  heading("Earnings");
  if (stub.hourly_cents) row("Hourly work", stub.hourly_cents);
  if (stub.flat_cents) row("Flat-fee deliverables", stub.flat_cents);
  if (stub.revshare_cents) row("Revenue share", stub.revshare_cents);
  if (stub.vacation_cents) row("Vacation pay", stub.vacation_cents);
  line(y - 4); y += 8;
  row("Gross pay", stub.gross_cents, true);

  // Deductions
  if (stub.worker_type === "employee") {
    heading("Deductions");
    row("CPP contribution", stub.cpp_cents);
    if (stub.cpp2_cents) row("CPP2 contribution", stub.cpp2_cents);
    row("Employment Insurance", stub.ei_cents);
    row("Federal income tax", stub.fed_tax_cents);
    row("Provincial income tax", stub.prov_tax_cents);
    line(y - 4); y += 8;
    row("Total deductions", stub.deductions_cents, true);
  } else {
    heading("Deductions");
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(120);
    doc.text("Contractor — no source deductions withheld. You are responsible for your own remittances.", M, y);
    y += 18;
  }

  if (stub.expense_cents) {
    heading("Non-taxable reimbursements");
    row("Expense reimbursement", stub.expense_cents);
  }

  // Net
  y += 6;
  doc.setFillColor(245, 245, 245);
  doc.rect(M, y - 4, W - M * 2, 30, "F");
  y += 16;
  value("NET PAY", M + 10, y, true);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(formatCents(stub.net_cents), W - M - 10, y, { align: "right" });
  y += 28;

  // YTD
  const ytd = stub.ytd || {};
  if (Object.keys(ytd).length) {
    heading("Year to date");
    doc.setFontSize(9);
    const cells: [string, number][] = [
      ["Gross", ytd.gross_cents ?? 0],
      ["CPP", (ytd.cpp_cents ?? 0) + (ytd.cpp2_cents ?? 0)],
      ["EI", ytd.ei_cents ?? 0],
      ["Income tax", (ytd.fed_tax_cents ?? 0) + (ytd.prov_tax_cents ?? 0)],
      ["Net", ytd.net_cents ?? 0],
    ];
    const colW = (W - M * 2) / cells.length;
    cells.forEach(([n, v], i) => {
      label(n, M + i * colW, y);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(20);
      doc.text(formatCents(v), M + i * colW, y + 13);
    });
    y += 30;
  }

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
