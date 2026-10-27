import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell } from "./shared";
import ProjectStory from "./ProjectStory";
import ReleasePrice, { formatReleasePrice } from "./ReleasePrice";
import ProjectMedia from './ProjectMedia';
import { Copy, ExternalLink, ArrowLeft, Share2, Coins, HandCoins } from 'lucide-react';
import { tokenPairingError, TOKEN_PAIRING_NOTICE } from "./token-pairing";
import "./portfolio.css";
import PortfolioHeart from './PortfolioHeart';
import ProjectRewards from './ProjectRewards';
import RelatedProjects from './RelatedProjects';
import './leaderboard.css';
import './board.css';
import PublicProjectCanvas from './PublicProjectCanvas';
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
  const [marketCap, setMarketCap] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const share = async () => { const url = location.href; try { if (navigator.share) { await navigator.share({ title: entry?.title, url }); return; } await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); } catch { /* cancelled */ } };
  const pumpUrl = saved.coin_mint ? `https://pump.fun/coin/${encodeURIComponent(saved.coin_mint)}` : '';
  const teamMail = (subject: string) => `mailto:collab@rhozeland.com?subject=${encodeURIComponent(subject)}`;
  useEffect(() => {
    let active = true;
    (supabase.rpc as any)('portfolio_detail', { p_slug: slug }).then(({ data: rows }: any) => { const data = Array.isArray(rows) ? rows[0] : rows; if (active && data) { setDetails(data); setSaved(data); } });
    supabase.auth.getUser().then(async ({ data }) => { if (!data.user) return; const result = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' }); if (active) setAdmin(result.data === true); });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    let active = true; setPrice(null); setMarketCap(null);
    if (!saved.coin_mint) return;
    const load = () => supabase.functions.invoke('pumpfun-coin', { body: { mint: saved.coin_mint } }).then(({ data }) => { if (active) { setPrice(typeof data?.priceUsd === 'number' && Number.isFinite(data.priceUsd) ? data.priceUsd : null); setMarketCap(typeof data?.mcap === 'number' && Number.isFinite(data.mcap) ? data.mcap : null); } });
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
  return <Shell className="rz-release-view"><article className="rz-portfolio rz-ws-dark rz-archive-dark">
    <Button variant="ghost" asChild><a href="/discover.html" onClick={e => { try { const ref = document.referrer ? new URL(document.referrer) : null; if (ref && ref.origin === location.origin && /^\/discover/.test(ref.pathname) && history.length > 1) { e.preventDefault(); history.back(); } } catch { /* fall through to link */ } }}><ArrowLeft size={16} /> Discover</a></Button>
    {entry === undefined ? <p>Loading project…</p> : !entry ? <h1>Project not found</h1> : <>
      {admin && <Button variant="outline" onClick={() => setEditing(!editing)}>{editing ? 'Close editor' : 'Edit project record'}</Button>}
      {editing && <section className="rz-ws"><h2>Edit project record</h2>{([['story', 'The story'], ['cultural_context', 'Cultural context'], ['rhozeland_contribution', "Rhozeland's contribution"]] as const).map(([key, label]) => <label key={key}>{label}<textarea className="rz-in" rows={4} value={details[key]} onChange={e => setDetails({ ...details, [key]: e.target.value })} /></label>)}<label>Solana contract address<input className="rz-in" value={details.coin_mint} onChange={e => setDetails({ ...details, coin_mint: e.target.value })} /></label><label>Ticker<input className="rz-in" value={details.coin_ticker} onChange={e => setDetails({ ...details, coin_ticker: e.target.value.toUpperCase() })} /></label><p className="rz-note">{TOKEN_PAIRING_NOTICE}</p><Button variant="outline" disabled={busy} onClick={saveDetails}>{busy ? 'Saving…' : 'Save project record'}</Button>{error && <p role="alert">{error}</p>}</section>}
      <header><div className="rz-portfolio-tools"><PortfolioHeart slug={slug} corner /><Button variant="outline" size="icon" className="rz-portfolio-share" aria-label={shared ? 'Link copied' : 'Share project'} title={shared ? 'Link copied' : 'Share project'} onClick={share}><Share2 size={16} /></Button><Button asChild className="rz-btn pri"><a href={pumpUrl || teamMail(`Support ${entry.title}`)} {...(pumpUrl ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>Support</a></Button></div><p className="rz-portfolio-kicker">Project archive · {entry.tag}</p><h1>{entry.title}</h1><p>{entry.artist.split(',').map((name, i) => { const profile = profiles[name.normalize('NFC').trim().toLowerCase()]; return <span key={name}>{i > 0 && ' · '}{profile ? <a href={`/creator/${profile}`}>{name}</a> : name}</span>; })}{entry.date && ` · ${entry.date}`}</p></header>
      <div className="rz-portfolio-body"><div className="rz-portfolio-narrative"><PublicProjectCanvas>
        {saved.coin_mint && <section className="rz-portfolio-chart"><ReleasePrice mint={saved.coin_mint} ticker={saved.coin_ticker} price={price} change={null} /></section>}
        <section><h2>About the project</h2><p>{entry.title} is a {entry.tag.toLowerCase()} by {entry.artist}{entry.date ? `, released in ${entry.date}` : ''}, featured in the Rhozeland portfolio.</p></section>
        <ProjectStory story={saved} />
        {!saved.rhozeland_contribution && <section><h2>Rhozeland's contribution</h2><p className="text-muted-foreground">Detailed production credits and the project's story have not been documented here yet.</p></section>}
      </PublicProjectCanvas></div><aside className="rz-portfolio-sidebar">
        <section className="rz-portfolio-media" aria-label="Original media">
          <ProjectMedia key={slug} links={[entry.source_url]} cover={entry.image} title={entry.title} />
        </section>
        <section className="rz-portfolio-coin" aria-label="Project coin"><h2><Coins size={14} /> Project coin</h2>
          {saved.coin_mint ? <><p>Paired with {saved.coin_ticker ? <b>${saved.coin_ticker}</b> : 'a coin'}{marketCap !== null && ` · ${formatReleasePrice(marketCap)} mcap`}.</p><div className="rz-portfolio-coin-actions"><Button asChild className="rz-btn pri"><a href={pumpUrl} target="_blank" rel="noopener noreferrer">Support</a></Button><Button variant="outline" asChild><a href={pumpUrl} target="_blank" rel="noopener noreferrer">Pump.fun</a></Button></div></>
            : <><p>No coin attached yet.</p><div className="rz-portfolio-coin-actions">{admin ? <Button variant="outline" onClick={() => setEditing(true)}>Attach a coin</Button> : <Button variant="outline" asChild><a href={teamMail(`Launch a coin for ${entry.title}`)}>Request a coin</a></Button>}</div></>}
        </section>
        <section className="rz-portfolio-coin" aria-label="Fund this project"><h2><HandCoins size={14} /> Fund this project</h2><p>Back {entry.title}'s next chapter or collaborate with the team behind it.</p><div className="rz-portfolio-coin-actions"><Button variant="outline" asChild><a href={teamMail(`Fund ${entry.title}`)}>Contact the team</a></Button></div></section>
        <section><h2>Project record</h2><dl><dt>Creator</dt><dd>{entry.artist}</dd><dt>Format</dt><dd>{entry.tag}</dd>{entry.date && <><dt>Released</dt><dd>{entry.date}</dd></>}</dl></section>
        <section className="rz-portfolio-activity" aria-label="Project activity"><h2>Project activity</h2><PortfolioHeart slug={slug} /><ProjectRewards portfolioSlug={slug} /></section>
      </aside></div>
      {saved.coin_mint && <section className="rz-portfolio-token" aria-label="Paired token">
        <header><h2>{saved.coin_ticker ? `$${saved.coin_ticker}` : 'Paired token'}</h2><span>Solana · Paired token</span></header>
        <dl className="rz-portfolio-token-stats"><div><dt>Price · USD</dt><dd>{price === null ? 'Unavailable' : formatReleasePrice(price)}</dd></div><div><dt>Market cap · USD</dt><dd>{marketCap === null ? 'Unavailable' : formatReleasePrice(marketCap)}</dd></div></dl>
        <div className="rz-portfolio-contract"><code>{saved.coin_mint}</code><Button size="icon" variant="outline" aria-label={copied ? 'Address copied' : 'Copy token address'} title={copied ? 'Address copied' : 'Copy token address'} onClick={async () => { try { await navigator.clipboard.writeText(saved.coin_mint); setCopied(true); } catch { setCopied(false); } }}><Copy size={16} /></Button><Button size="sm" variant="outline" asChild><a href={`https://solscan.io/token/${encodeURIComponent(saved.coin_mint)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Token details</a></Button></div>
        <p className="rz-note">{TOKEN_PAIRING_NOTICE}</p>
      </section>}
      <RelatedProjects href={`/project/${slug}`} artist={entry.artist} categories={entry.categories || entry.tag} />
    </>}
  </article></Shell>;
}