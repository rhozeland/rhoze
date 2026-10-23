export const ROLE_DETAIL_FIELDS = [
  { key: 'description', label: 'Responsibilities', placeholder: 'What will this person do or deliver?', multiline: true, optional: false },
  { key: 'requirements', label: 'Requirements', placeholder: 'Skills, experience or portfolio requirements', multiline: true, optional: false },
  { key: 'location', label: 'Location / work arrangement', placeholder: 'e.g. Remote, or on-site in Toronto', multiline: false, optional: false },
  { key: 'timing', label: 'Timing / commitment', placeholder: 'e.g. Two shoot days in November', multiline: false, optional: true },
] as const;
export type RoleDetails = { description?: string; requirements?: string; location?: string; timing?: string };
export function roleDetails(value: RoleDetails | null | undefined): RoleDetails {
  return Object.fromEntries(ROLE_DETAIL_FIELDS.flatMap(({ key }) => {
    const text = typeof value?.[key] === 'string' ? value[key]?.trim() : '';
    return text ? [[key, text]] : [];
  }));
}