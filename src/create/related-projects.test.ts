import { describe, expect, it } from 'vitest';
import { relatedProjects } from './related-projects';
import type { DiscoveryWork } from './discover-data';
const work = (href: string, categories = 'design', artist = 'Other'): DiscoveryWork => ({ id: href, href, categories, artist, title: href, image: null });
describe('related public projects', () => {
  it('shows other projects, not the current one', () => {
    expect(relatedProjects([work('/project/current'), work('/project/other')], { href: '/project/current' }).map(w => w.href)).toEqual(['/project/other']);
  });
  it('prefers matching creative categories and creators', () => {
    const result = relatedProjects([work('/project/design'), work('/release/music', 'audio', 'Ooak')], { href: '/project/current', categories: 'audio', artist: 'Ooak' });
    expect(result[0].href).toBe('/release/music');
  });
  it('does not recommend private workspace destinations or duplicate records', () => {
    expect(relatedProjects([work('/workspace/private'), work('/project/one'), work('/project/one')], { href: '/project/current' }).map(w => w.href)).toEqual(['/project/one']);
  });
});