import {useEffect,useState} from 'react';
import {Globe2,Play} from 'lucide-react';
import {Button} from '@/components/ui/button';
import DiscoverGlobe,{type GlobePin} from './globe/DiscoverGlobe';
import {publicLocation} from './globe/locations';
import {loadDiscovery,type DiscoveryWork} from './discover-data';
import FlowBrowser from './FlowBrowser';
import './discover-explorer.css';
export default function DiscoverExplorer(){
 const [mode,setMode]=useState<'globe'|'flow'>('globe'),[works,setWorks]=useState<DiscoveryWork[]>([]),[pins,setPins]=useState<GlobePin[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const load=()=>{setError('');loadDiscovery().then(data=>{setWorks(data.works);const p:GlobePin[]=[];for(const c of data.profiles){const coord=publicLocation(c.city,c.country);if(coord&&c.slug)p.push({id:c.id,kind:'creator',title:c.display_name,subtitle:c.bio,image:c.photo_url,href:'/creator/'+c.slug,...coord});}for(const r of data.releases){const a=r.answers as any;const coord=publicLocation(a?.city,a?.country);if(coord)p.push({id:r.id,kind:'release',title:r.title||'Project',subtitle:r.creator_name,image:r.cover_url||r.coin_image,href:'/release/'+r.slug,...coord});}setPins(p);setLoaded(true);}).catch(()=>{setError('Could not load discovery.');});};
 useEffect(()=>{load();},[]);
 return <section className="rz-discover-explorer"><div className="rz-explorer-heading"><div><small>Rhozeland around the world</small><h1>Discover</h1></div><div role="group" aria-label="Discover view"><Button variant="outline" aria-pressed={mode==='globe'} onClick={()=>setMode('globe')}><Globe2 size={16}/>Globe</Button><Button variant="outline" aria-pressed={mode==='flow'} onClick={()=>setMode('flow')}><Play size={16}/>Flow</Button></div></div>
 {error?<div role="alert">{error}<Button variant="outline" onClick={load}>Retry</Button></div>:!loaded?<p>Loading discovery…</p>:mode==='flow'?<FlowBrowser works={works}/>:<div className="rz-explorer-world"><DiscoverGlobe pins={pins}/><div className="rz-explorer-index"><p className="rz-explorer-label">{pins.length} public places</p>{pins.slice(0,5).map(p=><a href={p.href} key={p.id}><span>{p.image&&<img src={p.image} alt=""/>}<b>{p.title}</b></span><small>{p.city}</small></a>)}{!pins.length&&<p>Public locations will appear as creators add them.</p>}<Button variant="outline" onClick={()=>setMode('flow')}><Play size={15}/>Enter Flow</Button></div></div>}
 </section>;
}
