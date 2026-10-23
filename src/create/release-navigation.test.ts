import { describe, expect, it } from 'vitest';
import { openRoleHref, openRoleTarget } from './release-navigation';

describe('Discover open role navigation', () => {
  it('links to the release openings without starting an application', () => {
    expect(openRoleHref('winter', 0)).toBe('/release/winter?role=0#open-roles');
    expect(openRoleTarget('?role=0', '#open-roles', 1)).toEqual({ requested: true, index: 0 });
  });
  it('keeps invalid role indices from selecting a role', () => {
    expect(openRoleTarget('?role=-1', '#open-roles', 1).index).toBe(null);
    expect(openRoleTarget('?role=9', '#open-roles', 1).index).toBe(null);
  });
});