import { z } from "zod";

export const DEPARTMENTS = ["marketing", "hr", "development", "sales", "operations"] as const;
export type Department = (typeof DEPARTMENTS)[number];
export type Audience = "all" | "department" | "user" | "admin";

export type DocFormInput = {
  title: string;
  audience: Audience;
  department: string;
  target_user_id: string;
  file_url: string;
  file?: { name: string; type: string; size: number } | null;
};

export type FieldErrors = Partial<
  Record<"title" | "audience" | "department" | "target_user_id" | "file_url" | "file" | "_form", string>
>;

export type ValidateContext = {
  isAdmin: boolean;
  userId: string | null | undefined;
  /** Returns the matching profile or null when not found. Allows tests to inject a fake. */
  lookupProfile?: (id: string) => Promise<{ id: string; department: string | null } | null>;
};

const MAX_FILE_BYTES = 500 * 1024 * 1024;

function isAcceptedFile(f: { name: string; type: string }) {
  return (
    f.type === "application/pdf" ||
    f.type === "text/markdown" ||
    /\.md$/i.test(f.name) ||
    f.type.startsWith("image/") ||
    f.type.startsWith("video/")
  );
}

/**
 * Validate the New Doc form. Returns per-field errors so the UI can render
 * them inline. Also enforces:
 *   - only signed-in admins may publish
 *   - audience matches the chosen department/target
 *   - target employee actually exists (and, when both supplied, sits inside
 *     the chosen department)
 *   - file type & size are within the supported envelope
 */
export async function validateDocForm(
  form: DocFormInput,
  ctx: ValidateContext,
): Promise<{ ok: true; errors: Record<string, never> } | { ok: false; errors: FieldErrors }> {
  const errors: FieldErrors = {};

  if (!ctx.userId) {
    errors._form = "You must be signed in";
    return { ok: false, errors };
  }
  if (!ctx.isAdmin) {
    errors._form = "Only admins can publish docs";
    return { ok: false, errors };
  }

  const schema = z.object({
    title: z.string().trim().min(1, "Title required").max(200, "Title too long"),
    audience: z.enum(["all", "department", "user"]),
    department: z.enum(DEPARTMENTS).optional(),
    target_user_id: z.string().uuid("Pick a valid employee").optional(),
    file_url: z
      .string()
      .trim()
      .max(2048, "URL too long")
      .url("File URL must be a valid URL")
      .optional()
      .or(z.literal("")),
  });

  const parsed = schema.safeParse({
    title: form.title,
    audience: form.audience,
    department: form.department || undefined,
    target_user_id: form.target_user_id || undefined,
    file_url: form.file_url,
  });

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = (issue.path[0] as keyof FieldErrors) ?? "_form";
      if (!errors[key]) errors[key] = issue.message;
    }
  }

  if (form.audience === "department" && !form.department) {
    errors.department = "Pick a department";
  }
  if (form.audience === "user" && !form.target_user_id) {
    errors.target_user_id = "Pick an employee";
  }

  if (form.file) {
    if (!isAcceptedFile(form.file)) {
      errors.file = "Unsupported file type — use PDF, Markdown, image, or video";
    } else if (form.file.size > MAX_FILE_BYTES) {
      errors.file = "File must be under 500 MB";
    } else if (form.file.size <= 0) {
      errors.file = "File appears to be empty";
    }
  }

  // Async existence/audience check for "user" audience.
  if (form.audience === "user" && form.target_user_id && !errors.target_user_id && ctx.lookupProfile) {
    try {
      const target = await ctx.lookupProfile(form.target_user_id);
      if (!target) {
        errors.target_user_id = "Selected employee not found";
      } else if (form.department && target.department && target.department !== form.department) {
        errors.target_user_id = `Employee is not in the ${form.department} department`;
      }
    } catch {
      errors.target_user_id = "Could not verify employee";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, errors: {} };
}