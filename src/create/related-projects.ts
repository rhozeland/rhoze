import type { DiscoveryWork } from './discover-data';

type CurrentProject = { href: string; artist?: string; categories?: string };
const terms = (value = '') => new Set(value.toLowerCase().split(/[,/·\s]+/).filter(Boolean));

export function relatedProjects(works: DiscoveryWork[], current: CurrentProject, limit = 4) {
  const categories = terms(current.categories);
  const artists = terms(current.artist);
  const seen = new Set<string>();
  return works.filter(work => {
    if (work.href === current.href || seen.has(work.href) || !/^\/(project|release)\/[^/?#]+$/.test(work.href)) return false;
    seen.add(work.href);
    return true;
  }).map((work, index) => ({ work, index, score:
    [...terms(work.categories)].filter(term => categories.has(term)).length * 2 +
    [...terms(work.artist)].filter(term => artists.has(term)).length * 3,
  })).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit).map(({ work }) => work);
}