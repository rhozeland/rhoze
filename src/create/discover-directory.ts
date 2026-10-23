export type DiscoverView = 'work' | 'people' | 'open-calls';
export const PEOPLE_ROLES = ['Actor','Brand Strategist','Composer','Dancer','Designer','Developer','Editor','Influencer','Marketing Specialist','Model','Musician','Photographer','Rapper','Singer','Songwriter','Video Editor','Videographer'];
export function matchesDirectory(text: string, roles: string[], query: string, category: string) {
  return (category === 'All' || roles.some(r => r.toLocaleLowerCase() === category.toLocaleLowerCase())) && text.normalize('NFC').toLocaleLowerCase().includes(query.normalize('NFC').trim().toLocaleLowerCase());
}
export function discoverView(value: string | null): DiscoverView {
  return value === 'people' || value === 'open-calls' ? value : 'work';
}