import { z } from 'zod';
export const waitlistSchema = z.object({
 email: z.string().trim().toLowerCase().max(254, 'Please use a shorter email address.').email('Enter a valid email address.'),
 role: z.enum(['artist','brand','creative','fan'], { errorMap: () => ({ message: 'Choose how you create.' }) }),
 project: z.string().trim().max(500, 'Keep your project to 500 characters.'),
 referrer: z.string().max(64).regex(/^[a-zA-Z0-9]*$/),
});
export function visibleCount(count: number | null) { return count !== null && count > 25 ? count : null; }
export function csvCell(value: unknown) {
 let text = String(value ?? '');
 if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
 return '"' + text.replace(/"/g, '""') + '"';
}
