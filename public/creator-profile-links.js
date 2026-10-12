// Public, account-backed profiles only. Duplicate names must never pick an owner.
export function indexCreatorProfiles(people) {
  const byUser = Object.create(null);
  const byName = Object.create(null);
  for (const person of people) {
    if (!person.user_id || !person.slug) continue;
    byUser[person.user_id] = person;
    const name = (person.display_name || '').normalize('NFC').trim().toLowerCase();
    if (name) byName[name] = Object.prototype.hasOwnProperty.call(byName, name) ? null : person;
  }
  return { byUser, byName };
}