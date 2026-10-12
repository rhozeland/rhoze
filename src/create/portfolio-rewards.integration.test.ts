import {expect,it} from 'vitest';
import {createClient} from '@supabase/supabase-js';
const raw=process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
it.skipIf(!raw)('a signed-in portfolio like awards 25 points only once across unlike and re-like',async()=>{
 if(!raw)return;
 const session=JSON.parse(raw);
 const db=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${session.access_token}`}}});
 const existing=await db.from('portfolio_project_likes').select('id,liked').eq('user_id',session.user.id).eq('slug','sefra-cozal').single();expect(existing.error).toBeNull();if(!existing.data)throw Error('Signed-in UI verification must create a like first.');
 const before=await db.rpc('my_contribution_stats');expect(before.error).toBeNull();
 const unlike=await db.from('portfolio_project_likes').update({liked:false}).eq('id',existing.data.id);expect(unlike.error).toBeNull();
 const relike=await db.from('portfolio_project_likes').update({liked:true}).eq('id',existing.data.id);expect(relike.error).toBeNull();
 const after=await db.rpc('my_contribution_stats');expect(after.error).toBeNull();expect(after.data).toEqual(before.data);
 const project=await db.rpc('portfolio_reward_stats',{p_slug:'sefra-cozal'});expect(project.error).toBeNull();expect(project.data).toMatchObject({my_points:25,like_reward:25});
 const restore=await db.from('portfolio_project_likes').update({liked:existing.data.liked}).eq('id',existing.data.id);expect(restore.error).toBeNull();
},15000);
