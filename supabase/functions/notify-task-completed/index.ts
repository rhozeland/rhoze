import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { taskId } = await req.json()
    if (!taskId) {
      return new Response(JSON.stringify({ error: 'taskId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: task } = await supabase
      .from('tasks')
      .select('id, title, urgent, important, assigned_to, assigned_by, owner_id, updated_at')
      .eq('id', taskId)
      .maybeSingle()

    if (!task || !task.assigned_by) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const [{ data: adminProfile }, { data: assigneeProfile }] = await Promise.all([
      supabase.from('profiles').select('email, display_name').eq('id', task.assigned_by).maybeSingle(),
      supabase.from('profiles').select('display_name, email').eq('id', task.assigned_to ?? task.owner_id).maybeSingle(),
    ])

    if (!adminProfile?.email) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no admin email' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const quadrant = task.urgent && task.important ? 'Do'
      : !task.urgent && task.important ? 'Schedule'
      : task.urgent && !task.important ? 'Delegate'
      : 'Delete'

    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'task-completed',
        recipientEmail: adminProfile.email,
        idempotencyKey: `task-completed-${task.id}`,
        templateData: {
          taskTitle: task.title,
          assigneeName: assigneeProfile?.display_name || assigneeProfile?.email || 'Teammate',
          quadrant,
          completedAt: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
        },
      },
    })
    if (error) console.error('send task-completed email failed', error)

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('notify-task-completed error', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})