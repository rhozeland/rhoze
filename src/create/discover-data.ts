import { supabase } from '@/integrations/supabase/client';
export type DiscoveryWork = { id: string; title: string; artist: string; image: string | null; href: string; categories: string; source?: string; releaseId?: string; creatorHref?: string; video?: string };
export async function loadDiscovery() {
 const [archive, releases, creators] = await Promise.all([
  fetch('/portfolio-projects.json').then(r => r.json()),
  supabase.from('releases').select('id,slug,title,creator_name,user_id,answers,cover_url,coin_image').eq('status','published'),
  supabase.from('creator_directory').select('id,slug,display_name,user_id,city,country,photo_url,bio').eq('is_public',true).eq('approved',true).not('user_id','is',null),
 ]);
 if (releases.error || creators.error) throw Error('Public projects could not be loaded.');
 const profiles = creators.data || [];
 const resolve = (name: string, userId?: string | null) => { const found=profiles.filter(p=>userId ? p.user_id===userId : p.display_name.normalize('NFC').trim().toLowerCase()===name.normalize('NFC').trim().toLowerCase());return found.length===1&&found[0].slug ? '/creator/'+found[0].slug : undefined; };
 const works: DiscoveryWork[] = (releases.data || []).map(r=>({ id:r.id,releaseId:r.id,title:r.title||'Untitled project',artist:r.creator_name||'Creator',image:r.cover_url||r.coin_image,href:'/release/'+r.slug,categories:String((r.answers as any)?.category||'Project'),creatorHref:resolve(r.creator_name||'',r.user_id) }));
 for (const r of archive) works.push({id:r.slug,title:r.title,artist:r.artist,image:r.image,href:'/project/'+r.slug,categories:r.categories||r.tag||'Project',source:r.source_url,creatorHref:resolve(r.artist)});
 // Reuse committed hover clips; do not autoplay external media or disclose private attachments.
 if (typeof document!=='undefined') for (const w of works) { const card=Array.from(document.querySelectorAll<HTMLAnchorElement>('.work-card')).find(a=>a.getAttribute('href')===w.href); w.video=card?.querySelector<HTMLVideoElement>('video source')?.getAttribute('src')||undefined; }
 return { works, profiles, releases: releases.data || [] };
}
