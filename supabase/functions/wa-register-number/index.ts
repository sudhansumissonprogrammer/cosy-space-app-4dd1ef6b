import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GRAPH = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone_number_id } = await req.json().catch(() => ({}))
    const pnid = phone_number_id || '1248148541706026'
    const token = Deno.env.get('WA_ACCESS_TOKEN')
    const pin = Deno.env.get('WA_PHONE_PIN')

    if (!token || !pin) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing WA_ACCESS_TOKEN or WA_PHONE_PIN' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Register the number on Cloud API
    const regRes = await fetch(`${GRAPH}/${pnid}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    })
    const regJson = await regRes.json()

    // 2. Fetch status
    const statusRes = await fetch(`${GRAPH}/${pnid}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status,status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const statusJson = await statusRes.json()

    return new Response(JSON.stringify({
      ok: regRes.ok,
      register_response: regJson,
      number_status: statusJson,
    }, null, 2), {
      status: regRes.ok ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
