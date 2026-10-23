import { describe, expect, it } from 'vitest';
import { matchesDirectory, discoverView } from './discover-directory';
describe('shared discovery filters', () => {
  it('matches People by role and shared search together', () => {
    expect(matchesDirectory('Madi photographer', ['Photographer'], 'madi', 'Photographer')).toBe(true);
    expect(matchesDirectory('Madi photographer', ['Photographer'], 'madi', 'Designer')).toBe(false);
    expect(matchesDirectory('Madi photographer', ['Photographer'], 'other', 'Photographer')).toBe(false);
  });
  it('preserves People and Open calls deep links with Work as default', () => {
    expect(discoverView('people')).toBe('people');
    expect(discoverView('open-calls')).toBe('open-calls');
    expect(discoverView(null)).toBe('work');
  });
});