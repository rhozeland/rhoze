import { expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
const db = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
it('public standings exclude private, unapproved and unclaimed profiles',async()=>{
 const {data,error}=await db.rpc('creator_standings');
 expect(error).toBeNull();expect(data?.length).toBeGreaterThan(0);
 const profiles=await db.from('creator_directory').select('slug,user_id,is_public,approved').in('slug',(data??[]).map(r=>r.slug));
 expect(profiles.error).toBeNull();expect(profiles.data?.length).toBe(data?.length);
 for(const profile of profiles.data??[]){expect(profile.is_public).toBe(true);expect(profile.approved).toBe(true);expect(profile.user_id).not.toBeNull();}
},15000);
it('guest project totals expose no personal points and report the real like amount',async()=>{
 const {data,error}=await db.rpc('portfolio_reward_stats',{p_slug:'sefra-cozal'});expect(error).toBeNull();
 expect(data).toMatchObject({my_points:0,like_reward:25});
 const missing=await db.rpc('portfolio_reward_stats',{p_slug:'not-a-real-project'});expect(missing.error).toBeNull();expect(missing.data).toBeNull();
},15000);
it('guests cannot mint portfolio points',async()=>{
 const result=await db.from('portfolio_project_likes').insert({user_id:'00000000-0000-0000-0000-000000000001',slug:'sefra-cozal'});
 expect(result.error).not.toBeNull();
},15000);
it('published account-owned projects have real earned publication points',async()=>{
 const {data,error}=await db.rpc('creator_standings');expect(error).toBeNull();
 const projects=await db.from('releases').select('user_id').eq('status','published');expect(projects.error).toBeNull();
 const people=await db.from('creator_directory').select('slug,user_id').in('slug',(data??[]).map(r=>r.slug));expect(people.error).toBeNull();
 const publishers=(data??[]).filter(r=>{const person=people.data?.find(p=>p.slug===r.slug);return projects.data?.some(p=>p.user_id===person?.user_id);});
 expect(publishers.length).toBeGreaterThan(0);for(const row of publishers){expect(Number(row.xp)).toBeGreaterThanOrEqual(500);}
},15000);
