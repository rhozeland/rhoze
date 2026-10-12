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
it('public newcomers start at zero XP and zero contributions',async()=>{
 const {data,error}=await db.rpc('creator_standings');expect(error).toBeNull();
 const newcomers=(data??[]).filter(r=>Number(r.contributions)===0);
 expect(newcomers.length).toBeGreaterThan(0);
 for(const row of newcomers){expect(Number(row.xp)).toBe(0);}
},15000);
