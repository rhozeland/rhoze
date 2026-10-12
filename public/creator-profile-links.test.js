import { describe, it, expect } from 'vitest';
import { indexCreatorProfiles } from './creator-profile-links.js';

describe('Discover account links', () => {
  it('connects Indoléstic to an account-owned profile', () => {
    const profile = { display_name: 'Indoléstic', slug: 'indol-stic', user_id: 'owner' };
    expect(indexCreatorProfiles([profile]).byName['indoléstic']).toEqual(profile);
  });
  it('does not link accountless creators', () => {
    expect(indexCreatorProfiles([{ display_name: 'Unclaimed', slug: 'unclaimed', user_id: null }]).byName.unclaimed).toBeUndefined();
  });
  it('does not choose between accounts with the same name', () => {
    const profiles = ['one', 'two'].map(user_id => ({ display_name: 'Indoléstic', slug: user_id, user_id }));
    expect(indexCreatorProfiles(profiles).byName['indoléstic']).toBeNull();
    expect(indexCreatorProfiles(profiles).byUser.two.slug).toBe('two');
  });
});