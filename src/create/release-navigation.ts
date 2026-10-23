export function openRoleHref(slug: string, index: number) {
  return `/release/${encodeURIComponent(slug)}?role=${index}#open-roles`;
}

export function openRoleTarget(search: string, hash: string, roleCount: number) {
  const raw = new URLSearchParams(search).get('role');
  const index = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  return {
    requested: hash === '#open-roles' || raw !== null,
    index: index !== null && index < roleCount ? index : null,
  };
}