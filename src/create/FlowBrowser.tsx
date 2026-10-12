import {useEffect,useState,useRef} from 'react';
import {ChevronLeft,ChevronRight,ChevronUp,ChevronDown,Bookmark,ArrowUpRight,Share2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {supabase} from '@/integrations/supabase/client';
import {normalizeLoopedIndex} from './flow-navigation';
import {type DiscoveryWork} from './discover-data';
import ProjectBookmark from './ProjectBookmark';
import {ProjectHeart} from './ProjectLikes';
import ProjectDiscussion from './ProjectDiscussion';
export default function FlowBrowser({works}:{works:DiscoveryWork[]}) {
 const [index,setIndex]=useState(0),[bookmarks,setBookmarks]=useState<string[]>([]),[onlySaved,setOnlySaved]=useState(false),[category,setCategory]=useState('All'),[note,setNote]=useState('');
 const pointer=useRef<{x:number,y:number}|null>(null);
 const refresh=()=>supabase.auth.getUser().then(async({data})=>{if(!data.user){setBookmarks([]);return;}const r=await supabase.from('project_bookmarks').select('project_key').eq('user_id',data.user.id);setBookmarks((r.data||[]).map(x=>x.project_key));});
 useEffect(()=>{refresh();},[]);
 const visible=works.filter(w=>(!onlySaved||bookmarks.includes(w.href))&&(category==='All'||(category==='Music'?/audio|music/i.test(w.categories):/visual|film|video/i.test(w.categories))));
 const current=visible[normalizeLoopedIndex(index,visible.length)];
 const move=(n:number)=>{setIndex(i=>normalizeLoopedIndex(i+n,visible.length));setNote('');};
 useEffect(()=>{const keys=(e:KeyboardEvent)=>{if((e.target as HTMLElement).closest('input,textarea,select,button'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setIndex(i=>normalizeLoopedIndex(i+(e.key==='ArrowRight'?1:-1),visible.length));}};window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);},[visible.length]);
 return <div className="rz-flow-browser"><div className="rz-flow-filters"><div role="group" aria-label="Flow category">{['All','Music','Video'].map(c=><Button key={c} variant="outline" aria-pressed={category===c} onClick={()=>{setCategory(c);setIndex(0);}}>{c}</Button>)}</div><Button variant="outline" aria-pressed={onlySaved} onClick={()=>{setOnlySaved(!onlySaved);setIndex(0);refresh();}}><Bookmark size={15}/>Saved</Button></div>{!current?<p className="rz-flow-empty">{onlySaved?'No saved projects in this category.':'No projects in this category.'}</p>:<>
 <div className="rz-flow-surface" key={current.id} onPointerDown={e=>{if((e.target as HTMLElement).closest('a,button,video'))return;pointer.current={x:e.clientX,y:e.clientY};}} onPointerUp={e=>{const start=pointer.current;pointer.current=null;if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy))move(dx<0?1:-1);else if(dy<-70&&current.creatorHref)location.href=current.creatorHref;else if(dy>70)location.href=current.href;}}>
 <div className="rz-flow-media">{current.video?<video controls playsInline poster={current.image||undefined} src={current.video}/>:current.image?<img src={current.image} alt={`${current.title} — ${current.artist}`}/>:<span>{current.title}</span>}</div>
 <div className="rz-flow-caption"><div><small>{String(current.categories).replace(/,/g,' · ')}</small><h2><a href={current.href}>{current.title}</a></h2>{current.creatorHref?<a href={current.creatorHref}>{current.artist}</a>:<p>{current.artist}</p>}</div><span>{normalizeLoopedIndex(index,visible.length)+1} / {visible.length}</span></div>
 </div>
 <div className="rz-flow-controls"><div role="group" aria-label="Browse flow"><Button variant="outline" size="icon" title="Previous project" aria-label="Previous project" onClick={()=>move(-1)}><ChevronLeft/></Button><Button variant="outline" size="icon" title="Creator profile" aria-label="Creator profile" disabled={!current.creatorHref} asChild={!!current.creatorHref}>{current.creatorHref?<a href={current.creatorHref}><ChevronUp/></a>:<ChevronUp/>}</Button><Button variant="outline" size="icon" title="Open project" aria-label="Open project" asChild><a href={current.href}><ChevronDown/></a></Button><Button variant="outline" size="icon" title="Next project" aria-label="Next project" onClick={()=>move(1)}><ChevronRight/></Button></div><div>{current.releaseId&&<ProjectHeart releaseId={current.releaseId}/>}<ProjectBookmark href={current.href} onChanged={refresh}/><Button variant="outline" size="icon" title="Share project" aria-label="Share project" onClick={async()=>{try{await navigator.clipboard.writeText(location.origin+current.href);setNote('Project link copied.');}catch{setNote('Could not copy the link.');}}}><Share2 size={17}/></Button><Button variant="outline" asChild><a href={current.href}>Project<ArrowUpRight size={15}/></a></Button></div></div>{note&&<p role="status">{note}</p>}
 {current.releaseId&&<ProjectDiscussion releaseId={current.releaseId}/>}</>}
 </div>;
}
