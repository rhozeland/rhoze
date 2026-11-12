// Returns a published release's public teaser posts with short-lived signed media URLs.
// Storage reads of release-posts stay owner-only; only the server signs public teaser files.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { slug } = await req.json().catch(() => ({}));
    if (typeof slug !== 'string' || !/^[a-z0-9-]{1,120}$/i.test(slug)) return json({ error: 'bad_request' }, 400);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await db.rpc('release_public_posts', { p_slug: slug });
    if (error) return json({ error: 'server' }, 500);
    const posts = await Promise.all((data ?? []).map(async (p: any) => {
      let media_url: string | null = null;
      if (p.media_path) media_url = (await db.storage.from('release-posts').createSignedUrl(p.media_path, 3600)).data?.signedUrl ?? null;
      return { id: p.id, body: p.body, media_kind: p.media_kind, link_url: p.link_url, created_at: p.created_at, media_url };
    }));
    return json({ posts });
  } catch {
    return json({ error: 'server' }, 500);
  }
});
