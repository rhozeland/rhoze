export const formatCents = (cents: number | null | undefined) => {
  const n = (cents ?? 0) / 100;
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2 });
};

export const toCents = (val: string | number) => {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
};

export const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};