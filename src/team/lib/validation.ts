import { z } from "zod";

// Format a phone string as you type. Keeps + and digits only, groups for NANP.
export function formatPhone(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (hasPlus) {
    // International: keep grouping minimal
    if (digits.length <= 3) return `+${digits}`;
    if (digits.length <= 6) return `+${digits.slice(0, 1)} ${digits.slice(1)}`;
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)} ${digits.slice(-7, -4)} ${digits.slice(-4)}`.trim();
  }
  // NANP-style grouping
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  // Treat as 1-prefixed
  return `+${digits.slice(0, digits.length - 10)} (${digits.slice(-10, -7)}) ${digits.slice(-7, -4)}-${digits.slice(-4)}`;
}

const phoneDigits = (s: string) => s.replace(/\D/g, "");

export const phoneSchema = z
  .string()
  .trim()
  .max(32, { message: "Phone must be under 32 characters" })
  .refine((v) => v === "" || phoneDigits(v).length >= 7, { message: "Phone must have at least 7 digits" })
  .refine((v) => v === "" || phoneDigits(v).length <= 15, { message: "Phone has too many digits" })
  .refine((v) => v === "" || /^[+\d\s().-]+$/.test(v), { message: "Phone can only contain digits, +, spaces, ( ), - and ." });

export const dobSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { message: "Use YYYY-MM-DD" })
  .refine((v) => {
    if (v === "") return true;
    const d = new Date(v);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    if (d > now) return false;
    if (d < new Date("1900-01-01")) return false;
    return true;
  }, { message: "Pick a real date between 1900 and today" });

export const personNameSchema = z
  .string()
  .trim()
  .max(80, { message: "Must be under 80 characters" })
  .refine((v) => v === "" || v.length >= 2, { message: "Must be at least 2 characters" })
  .refine((v) => v === "" || /^[\p{L}\p{M}\s'.\-]+$/u.test(v), { message: "Letters, spaces, apostrophes and hyphens only" });

export const relationSchema = z
  .string()
  .trim()
  .max(40, { message: "Must be under 40 characters" })
  .refine((v) => v === "" || /^[\p{L}\s\-]+$/u.test(v), { message: "Letters, spaces and hyphens only" });

export const mastersheetSchemas = {
  phone: phoneSchema,
  date_of_birth: dobSchema,
  emergency_contact_name: personNameSchema,
  emergency_contact_relation: relationSchema,
  emergency_contact_phone: phoneSchema,
} as const;

export type MastersheetField = keyof typeof mastersheetSchemas;

export function validateField(field: MastersheetField, value: string): string | null {
  const schema = mastersheetSchemas[field];
  const r = schema.safeParse(value ?? "");
  return r.success ? null : r.error.issues[0]?.message ?? "Invalid value";
}

export function validateAll(values: Partial<Record<MastersheetField, string>>): Partial<Record<MastersheetField, string>> {
  const errors: Partial<Record<MastersheetField, string>> = {};
  (Object.keys(mastersheetSchemas) as MastersheetField[]).forEach((k) => {
    const v = values[k];
    if (v === undefined) return;
    const err = validateField(k, v);
    if (err) errors[k] = err;
  });
  return errors;
}