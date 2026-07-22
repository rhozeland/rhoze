import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TEAM_RECIPIENTS = ['collab@rhozeland.com']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: userData, error: userErr } = await authClient.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = await req.json().catch(() => ({}))
    const pledgeId: string | undefined = body?.pledgeId
    if (!pledgeId) {
      return new Response(JSON.stringify({ error: 'pledgeId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: pledge } = await supabase
      .from('investor_pledges')
      .select('id, user_id, amount_usd_cents, fee_usd_cents, lock_months, tier_slug, path, payment_method, solana_wallet, notes, status, created_at, credits_awarded')
      .eq('id', pledgeId)
      .maybeSingle()

    if (!pledge) {
      return new Response(JSON.stringify({ skipped: true, reason: 'pledge not found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Only the pledger (or team) can trigger notification for their pledge.
    if (pledge.user_id !== userData.user.id) {
      const { data: isTeam } = await supabase.rpc('is_team_member', { _user_id: userData.user.id })
      if (!isTeam) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', pledge.user_id)
      .maybeSingle()

    const amountUsd = (pledge.amount_usd_cents ?? 0) / 100
    const feeUsd = (pledge.fee_usd_cents ?? 0) / 100
    const totalUsd = amountUsd + feeUsd

    const templateData = {
      pledgeId: pledge.id,
      pledgerName: profile?.display_name || profile?.email || 'A new investor',
      pledgerEmail: profile?.email || '—',
      amountUsd: amountUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      feeUsd: feeUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      totalUsd: totalUsd.toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
      tier: pledge.tier_slug || '—',
      path: pledge.path || '—',
      paymentMethod: pledge.payment_method || '—',
      lockMonths: pledge.lock_months ?? 0,
      solanaWallet: pledge.solana_wallet || '—',
      notes: pledge.notes || '',
      creditsAwarded: pledge.credits_awarded ?? 0,
      submittedAt: new Date(pledge.created_at as string).toLocaleString('en-US', { timeZone: 'America/New_York' }),
    }

    const results: Array<{ to: string; ok: boolean; error?: string }> = []
    for (const to of TEAM_RECIPIENTS) {
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'new-pledge-notification',
          recipientEmail: to,
          idempotencyKey: `new-pledge-${pledge.id}-${to}`,
          templateData,
        },
      })
      results.push({ to, ok: !error, error: error?.message })
      if (error) console.error('send new-pledge email failed', to, error)
    }

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('notify-new-pledge error', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
