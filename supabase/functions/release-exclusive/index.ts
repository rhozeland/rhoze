// Returns a release's exclusive posts to a wallet that proves (by signing a
// message) it holds the release's coin. Media comes back as short-lived signed URLs.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import nacl from 'npm:tweetnacl@1.0.3';
import bs58 from 'npm:bs58@6.0.0';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const isAddr = (s: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

function rpcUrl() {
  const key = Deno.env.get('HELIUS_API_KEY');
  return key ? `https://mainnet.helius-rpc.com/?api-key=${key}` : 'https://api.mainnet-beta.solana.com';
}

async function balance(owner: string, mint: string) {
  const r = await fetch(rpcUrl(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner', params: [owner, { mint }, { encoding: 'jsonParsed' }] }),
  });
  const j = await r.json();
  if (j.error) throw new Error('rpc');
  let b = 0;
  for (const a of j.result?.value ?? []) {
    const amt = a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
    if (typeof amt === 'number') b += amt;
  }
  return b;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { slug, wallet, message, signature } = await req.json().catch(() => ({}));
    if (typeof slug !== 'string' || !slug || typeof wallet !== 'string' || !isAddr(wallet) || typeof message !== 'string' || typeof signature !== 'string')
      return json({ error: 'bad_request' }, 400);

    const lines = message.split('\n');
    if (lines[0] !== 'Rhoze exclusive access' || lines[1] !== `Project: ${slug}` || lines[2] !== `Wallet: ${wallet}`)
      return json({ error: 'bad_message' }, 400);
    const ts = Date.parse((lines[3] || '').replace('Time: ', ''));
    if (!ts || Math.abs(Date.now() - ts) > 15 * 60 * 1000) return json({ error: 'expired' }, 401);

    const ok = nacl.sign.detached.verify(new TextEncoder().encode(message), bs58.decode(signature), bs58.decode(wallet));
    if (!ok) return json({ error: 'bad_signature' }, 401);

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: rel } = await db.from('releases').select('id,coin_mint').eq('slug', slug).eq('status', 'published').maybeSingle();
    if (!rel?.coin_mint) return json({ error: 'no_coin' }, 404);

    if ((await balance(wallet, rel.coin_mint)) <= 0) return json({ holds: false, posts: [] });

    const { data: posts } = await db.from('release_posts').select('id,body,media_path,media_kind,created_at')
      .eq('release_id', rel.id).order('created_at', { ascending: false }).limit(100);
    const out = await Promise.all((posts ?? []).map(async (p) => {
      let media_url: string | null = null;
      if (p.media_path) {
        const { data } = await db.storage.from('release-posts').createSignedUrl(p.media_path, 3600);
        media_url = data?.signedUrl ?? null;
      }
      return { id: p.id, body: p.body, media_kind: p.media_kind, media_url, created_at: p.created_at };
    }));
    return json({ holds: true, posts: out });
  } catch {
    return json({ error: 'server' }, 500);
  }
});
