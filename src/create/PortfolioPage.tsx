import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell } from "./shared";
import ProjectStory from "./ProjectStory";
import ReleasePrice from "./ReleasePrice";
import { tokenPairingError, TOKEN_PAIRING_NOTICE } from "./token-pairing";
import "./portfolio.css";
import PortfolioHeart from './PortfolioHeart';
import ProjectRewards from './ProjectRewards';
import './leaderboard.css';
type Entry = { slug: string; title: string; artist: string; image: string; source_url: string; tag: string; date: string; categories: string; story?: string; cultural_context?: string; rhozeland_contribution?: string };
export default function PortfolioPage({ slug }: { slug: string }) {
  const [entry, setEntry] = useState<Entry | null | undefined>();
  const [profiles, setProfiles] = useState<Record<string, string | null>>({});
  const [admin, setAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState({ story: '', cultural_context: '', rhozeland_contribution: '', coin_mint: '', coin_ticker: '' });
  const [saved, setSaved] = useState(details);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    supabase.from('portfolio_details').select('*').eq('slug', slug).maybeSingle().then(({ data }) => { if (active && data) { setDetails(data); setSaved(data); } });
    supabase.auth.getUser().then(async ({ data }) => { if (!data.user) return; const result = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' }); if (active) setAdmin(result.data === true); });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    let active = true; setPrice(null);
    if (!saved.coin_mint) return;
    const load = () => supabase.functions.invoke('pumpfun-coin', { body: { mint: saved.coin_mint } }).then(({ data }) => { if (active) setPrice(typeof data?.priceUsd === 'number' ? data.priceUsd : null); });
    load(); const timer = setInterval(load, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [saved.coin_mint]);
  const saveDetails = async () => {
    const invalid = tokenPairingError(details.coin_mint);
    if (invalid) { setError(invalid); return; }
    setBusy(true); setError('');
    const payload = { ...details, slug, coin_mint: details.coin_mint.trim() };
    const { error } = await supabase.from('portfolio_details').upsert(payload);
    setBusy(false);
    if (error) { setError('Could not save. Only the Rhozeland team can edit this archive.'); return; }
    setSaved(payload); setEditing(false);
  };
  useEffect(() => {
    let active = true;
    fetch('/portfolio-projects.json').then(r => { if (!r.ok) throw Error(); return r.json(); }).then((rows: Entry[]) => { if (active) setEntry(rows.find(r => r.slug === slug) || null); }).catch(() => { if (active) setEntry(null); });
    supabase.from('creator_directory').select('slug,display_name,user_id').eq('is_public', true).eq('approved', true).not('user_id', 'is', null).then(({ data }) => {
      const names: Record<string, string | null> = {};
      for (const p of data || []) { const key = p.display_name.normalize('NFC').trim().toLowerCase(); names[key] = Object.prototype.hasOwnProperty.call(names, key) ? null : p.slug; }
      if (active) setProfiles(names);
    });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => { if (entry) document.title = `${entry.title} — Project archive | Rhozeland`; }, [entry]);
  return <Shell className="rz-release-view"><article className="rz-portfolio">
    <Button variant="ghost" asChild><a href="/discover.html">← Discover</a></Button>
    {entry === undefined ? <p>Loading project…</p> : !entry ? <h1>Project not found</h1> : <>
      {admin && <Button variant="outline" onClick={() => setEditing(!editing)}>{editing ? 'Close editor' : 'Edit project record'}</Button>}
      {editing && <section className="rz-ws"><h2>Edit project record</h2>{([['story', 'The story'], ['cultural_context', 'Cultural context'], ['rhozeland_contribution', "Rhozeland's contribution"]] as const).map(([key, label]) => <label key={key}>{label}<textarea className="rz-in" rows={4} value={details[key]} onChange={e => setDetails({ ...details, [key]: e.target.value })} /></label>)}<label>Solana contract address<input className="rz-in" value={details.coin_mint} onChange={e => setDetails({ ...details, coin_mint: e.target.value })} /></label><label>Ticker<input className="rz-in" value={details.coin_ticker} onChange={e => setDetails({ ...details, coin_ticker: e.target.value.toUpperCase() })} /></label><p className="rz-note">{TOKEN_PAIRING_NOTICE}</p><Button variant="outline" disabled={busy} onClick={saveDetails}>{busy ? 'Saving…' : 'Save project record'}</Button>{error && <p role="alert">{error}</p>}</section>}
      <header><p className="rz-portfolio-kicker">Project archive · {entry.tag}</p><h1>{entry.title}</h1><p>{entry.artist.split(',').map((name, i) => { const profile = profiles[name.normalize('NFC').trim().toLowerCase()]; return <span key={name}>{i > 0 && ' · '}{profile ? <a href={`/creator/${profile}`}>{name}</a> : name}</span>; })}{entry.date && ` · ${entry.date}`}</p></header>
      <PortfolioHeart slug={slug} />
      <ProjectRewards portfolioSlug={slug} />
      <img className="rz-portfolio-cover" src={entry.image} alt={`${entry.title} — ${entry.artist}`} />
      <div className="rz-portfolio-body"><aside><h2>Project record</h2><dl><dt>Creator</dt><dd>{entry.artist}</dd><dt>Format</dt><dd>{entry.tag}</dd>{entry.date && <><dt>Released</dt><dd>{entry.date}</dd></>}</dl><Button variant="outline" asChild><a href={entry.source_url} target="_blank" rel="noopener noreferrer">View original work ↗</a></Button></aside><div>
        <section><h2>About the project</h2><p>{entry.title} is a {entry.tag.toLowerCase()} by {entry.artist}{entry.date ? `, released in ${entry.date}` : ''}, featured in the Rhozeland portfolio.</p></section>
        <ProjectStory story={saved} />
        {!saved.rhozeland_contribution && <section><h2>Rhozeland's contribution</h2><p className="text-muted-foreground">Detailed production credits and the project's story have not been documented here yet.</p></section>}
        {saved.coin_mint && <><h2>Paired token</h2><p className="break-all text-sm">{saved.coin_mint}</p><ReleasePrice mint={saved.coin_mint} ticker={saved.coin_ticker} price={price} change={null} /><p className="text-sm text-muted-foreground">{TOKEN_PAIRING_NOTICE}</p></>}
      </div></div>
    </>}
  </article></Shell>;
}