import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Search, Shuffle, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import DiscoverExplorer from './DiscoverExplorer';
import { hasOpenRoles } from './project-flow';
import { discoverView, matchesDirectory, PEOPLE_ROLES, type DiscoverView } from './discover-directory';
import './discover-directory.css';
import { openRoleHref } from './release-navigation';

type Person = { id: string; slug: string | null; display_name: string; photo_url: string | null; disciplines: string[] | null; bio: string | null; hourly_rate_cents: number | null; hourly_rate_max_cents: number | null; rating: number | null; completed_projects: number | null; trending: boolean | null };
type Call = { slug: string; title: string; creator_name: string; answers: { roles?: { name: string; count?: number; rate?: string }[]; makers?: unknown; description?: string } | null };
const views = [{ id: 'work', label: 'Work' }, { id: 'people', label: 'People' }, { id: 'open-calls', label: 'Open Calls' }] as const;
const rate = (p: Person) => {
  if (!p.hourly_rate_cents || p.hourly_rate_cents <= 0) return 'Rate on request';
  const f = (n: number) => '$' + (n / 100).toLocaleString('en-CA');
  return `Starting from ${f(p.hourly_rate_cents)}${p.hourly_rate_max_cents && p.hourly_rate_max_cents > p.hourly_rate_cents ? '–' + f(p.hourly_rate_max_cents) : ''}/hr`;
};
export default function DiscoverDirectory() {
  const [view, setView] = useState<DiscoverView>(() => discoverView(new URLSearchParams(location.search).get('view')));
  const [query, setQuery] = useState(''), [category, setCategory] = useState('All'), [people, setPeople] = useState<Person[]>([]), [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [page, setPage] = useState(1);
  const [connectedOnly, setConnectedOnly] = useState(false);
  const load = async () => {
    setLoading(true); setError('');
    try {
      const [p, c] = await Promise.all([
        supabase.from('creator_directory').select('id,slug,display_name,photo_url,disciplines,bio,hourly_rate_cents,hourly_rate_max_cents,rating,completed_projects,trending').eq('approved', true).eq('is_public', true).neq('account_kind', 'supporter').order('created_at', { ascending: false }),
        supabase.from('releases').select('slug,title,creator_name,answers').eq('status', 'published').order('published_at', { ascending: false }),
      ]);
      if (p.error || c.error) throw Error();
      setPeople((p.data || []).filter(p => p.slug) as Person[]);
      setCalls((c.data || []).filter(c => c.slug && hasOpenRoles(c.answers as Call['answers'])) as Call[]);
    } catch { setError('People and open calls could not load. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const url = new URL(location.href); if (view === 'work') url.searchParams.delete('view'); else url.searchParams.set('view', view);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    document.body.dataset.discoverView = view;
    document.body.dataset.discoverCoinFilter = connectedOnly ? 'connected' : 'all';
    window.dispatchEvent(new CustomEvent('rz-discover-work', { detail: { query, category: category === 'All' ? 'portfolio' : category.toLowerCase(), connectedOnly } }));
    const input = document.getElementById('projectSearch') as HTMLInputElement | null;
    if (input) input.value = query;
  }, [view, query, category, connectedOnly]);
  const changeView = (next: DiscoverView) => { setView(next); setCategory('All'); setPage(1); };
  const roles = useMemo(() => Array.from(new Set(calls.flatMap(c => c.answers?.roles?.map(r => r.name).filter(Boolean) || []))).sort(), [calls]);
  const chips = view === 'work' ? ['All', 'Visual', 'Audio', 'Development'] : view === 'people' ? ['All', ...PEOPLE_ROLES] : ['All', ...roles];
  const filteredPeople = people.filter(p => matchesDirectory([p.display_name, p.bio, ...(p.disciplines || [])].join(' '), p.disciplines || [], query, category));
  const filteredCalls = calls.filter(c => matchesDirectory([c.title, c.creator_name, c.answers?.description, ...(c.answers?.roles?.map(r => r.name) || [])].join(' '), c.answers?.roles?.map(r => r.name) || [], query, category));
  return <section className="rz-discovery-hub">
    <div className="rz-discovery-top"><h1>Discover</h1><Button asChild><a href="/create.html?new=1">Create a project<ArrowUpRight size={15}/></a></Button></div>
    <nav aria-label="Discover sections" className="rz-discovery-switch">{views.map(v => <Button key={v.id} variant="ghost" aria-pressed={view === v.id} onClick={() => changeView(v.id)}>{v.label}</Button>)}</nav>
    <div className="rz-discovery-search-row"><label className="rz-discovery-search"><Search size={17}/><input type="search" aria-label="Search Discover" placeholder={view === 'work' ? 'Search projects…' : view === 'people' ? 'Search people or skills…' : 'Search projects or roles…'} value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label>{view === 'work' ? <Button variant="outline" size="icon" aria-label="Shuffle projects" title="Shuffle projects" onClick={() => document.getElementById('shuffleToggle')?.click()}><Shuffle size={16}/></Button> : <Select value={category} onValueChange={value => { setCategory(value); setPage(1); }}><SelectTrigger className="rz-discovery-role-filter" aria-label="Filter by role"><SelectValue/></SelectTrigger><SelectContent className="rz-discovery-role-menu">{chips.map(c => <SelectItem key={c} value={c}>{c === 'All' ? 'All roles' : c}</SelectItem>)}</SelectContent></Select>}</div>
    {view === 'work' && <div className="rz-discovery-chips" role="group" aria-label="Work categories">{chips.map(c => <Button key={c} variant="outline" aria-pressed={category === c} onClick={() => { setCategory(c); setPage(1); }}>{c === 'All' ? 'All work' : c}</Button>)}<Button className="rz-discovery-coin-filter" variant="outline" aria-pressed={connectedOnly} onClick={() => setConnectedOnly(value => !value)}><Coins size={14}/>Connected coin</Button></div>}
    {view === 'work' ? <details className="rz-discovery-explore"><summary>Globe & Flow</summary><DiscoverExplorer/></details> : <>
      {loading ? <p role="status" className="rz-directory-status">Loading {view === 'people' ? 'people' : 'open calls'}…</p> : error ? <div role="alert" className="rz-directory-status">{error}<Button variant="outline" onClick={load}>Retry</Button></div> : <>
      <p role="status" className="rz-directory-status">{view === 'people' ? `${filteredPeople.length} people` : `${filteredCalls.length} open calls`}</p>
      <div className={'rz-directory-grid' + (view === 'people' ? ' rz-people-masonry' : '')}>{view === 'people' ? filteredPeople.slice((page - 1) * 15, page * 15).map(p => <article className="rz-person-card" key={p.id}>
        <div className="rz-person-identity"><a href={'/creator/' + encodeURIComponent(p.slug || '')} className="rz-person-portrait" aria-label={'View profile for ' + p.display_name}>{p.photo_url ? <img src={p.photo_url} alt={p.display_name} loading="lazy"/> : <span>{p.display_name.charAt(0)}</span>}</a>
        <div className="rz-person-info"><h2><a href={'/creator/' + encodeURIComponent(p.slug || '')}>{p.display_name}</a></h2>{!!p.disciplines?.length && <p>{p.disciplines.join(' · ')}</p>}</div></div>
        {(p.rating !== null || p.trending || !!p.completed_projects) && <div className="rz-person-signals">{p.rating !== null && <small className="rz-person-rating">★ {Number(p.rating).toFixed(1)}</small>}{!!p.completed_projects && <small>{p.completed_projects} projects</small>}{p.trending && <small className="rz-person-trending">Trending</small>}</div>}
        <div className="rz-person-footer"><p>{rate(p)}</p></div>
      </article>) : filteredCalls.map(c => <article key={c.slug} className="rz-call-card"><header className="rz-call-heading"><div className="rz-call-identity"><h2><a href={'/release/' + encodeURIComponent(c.slug)}>{c.title}</a></h2>{c.creator_name && <p>{c.creator_name}</p>}</div><Button size="icon" asChild><a href={'/release/' + encodeURIComponent(c.slug)} aria-label={'Open project ' + c.title} title={'Open project ' + c.title}><ArrowUpRight size={17}/></a></Button></header><div className="rz-call-roles">{c.answers?.roles?.map((r, i) => r.name?.trim() && <Button variant="ghost" asChild key={i}><a href={openRoleHref(c.slug, i)} aria-label={'View ' + r.name + ' opening on ' + c.title}><span className="rz-call-role-name">{r.name}</span><span className="rz-call-role-meta">{Number(r.count) > 1 && <small>×{r.count}</small>}{r.rate && <small>{r.rate}</small>}<ArrowUpRight size={14}/></span></a></Button>)}</div></article>)}</div>
      {(view === 'people' ? !filteredPeople.length : !filteredCalls.length) && <p className="rz-directory-empty">{query || category !== 'All' ? 'No matches. Try another search or role.' : view === 'people' ? 'No public people listed yet.' : 'No open calls right now.'}</p>}
      {view === 'people' && filteredPeople.length > 15 && <nav className="rz-directory-pages" aria-label="People pages">{Array.from({ length: Math.ceil(filteredPeople.length / 15) }, (_, i) => <Button key={i} variant="outline" aria-current={page === i + 1 ? 'page' : undefined} onClick={() => setPage(i + 1)}>{i + 1}</Button>)}</nav>}
      </>}
    </>}
  </section>;
}