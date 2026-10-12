import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
export default function ProjectRewards({releaseId,portfolioSlug}:{releaseId?:string;portfolioSlug?:string}) {
 const [stats,setStats]=useState<{points:number;my_points:number;like_reward:number}|null>(null);
 useEffect(()=>{let live=true;const load=async()=>{const result=portfolioSlug?await supabase.rpc('portfolio_reward_stats',{p_slug:portfolioSlug}):releaseId?await supabase.rpc('project_reward_stats',{p_release_id:releaseId}):null;if(live&&result&&!result.error)setStats(result.data as typeof stats);};load();window.addEventListener('rhoze:rewards',load);const {data}=supabase.auth.onAuthStateChange(()=>setTimeout(load,0));return()=>{live=false;window.removeEventListener('rhoze:rewards',load);data.subscription.unsubscribe();};},[releaseId,portfolioSlug]);
 if(!stats)return null;
 return <section className="rz-project-points" aria-label="Project points"><a href="/rewards?tab=leaders"><b>{Number(stats.points).toLocaleString()} points earned</b></a><span>{stats.my_points>0?`Your contributions: ${Number(stats.my_points).toLocaleString()} points`:`First like earns ${stats.like_reward} points`}</span></section>;
}
