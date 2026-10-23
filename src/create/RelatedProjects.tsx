import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadDiscovery, type DiscoveryWork } from './discover-data';
import { relatedProjects } from './related-projects';
import './related-projects.css';

export default function RelatedProjects({ href, artist, categories }: { href: string; artist?: string; categories?: string }) {
  const [works, setWorks] = useState<DiscoveryWork[]>([]);
  useEffect(() => {
    let active = true;
    loadDiscovery().then(data => { if (active) setWorks(data.works); }).catch(async () => {
      // The committed public archive remains available during account-service outages.
      try {
        const response = await fetch('/portfolio-projects.json');
        if (!response.ok) return;
        const archive = await response.json();
        if (active) setWorks(archive.map((entry: { slug: string; title: string; artist: string; image: string; categories: string; tag: string }) => ({
          id: entry.slug, href: `/project/${entry.slug}`, title: entry.title, artist: entry.artist,
          image: entry.image, categories: entry.categories || entry.tag,
        })));
      } catch { /* Leave discovery navigation available if the public archive is unavailable. */ }
    });
    return () => { active = false; };
  }, []);
  const recommendations = relatedProjects(works, { href, artist, categories });
  return <section className="rz-related" aria-label="More like this">
    <header className="rz-related-heading"><h2>More like this</h2><Button variant="outline" size="sm" asChild><a href="/discover.html" target="_top">View all projects <ArrowUpRight size={14} /></a></Button></header>
    <div className="rz-related-grid">
      {recommendations.map(work => <a className="rz-related-card" key={work.href} href={work.href} target="_top">
        <div className="rz-related-art">{work.image ? <img src={work.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }} /> : <span>{work.title}</span>}</div>
        <h3>{work.title}</h3><p>{work.artist}</p>
      </a>)}
    </div>
  </section>;
}