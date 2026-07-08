import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { metaFetch } from '../_shared/wa-platform.ts'

const GRAPH = 'https://graph.facebook.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone_number_id } = await req.json().catch(() => ({}))
    const pnid = phone_number_id || '1248148541706026'
    const token = Deno.env.get('WA_ACCESS_TOKEN')
    const pin = Deno.env.get('WA_PHONE_PIN')
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    if (!token || !pin) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing WA_ACCESS_TOKEN or WA_PHONE_PIN' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 1. Register the number on Cloud API
    const regRes = await metaFetch(admin, `${GRAPH}/${pnid}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    }, { source: 'wa-register-number:register' })
    const regJson = regRes.body

    // 2. Fetch status
    const statusRes = await metaFetch(admin, `${GRAPH}/${pnid}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,name_status,status`, {
      headers: { Authorization: `Bearer ${token}` },
    }, { source: 'wa-register-number:status' })
    const statusJson = statusRes.body

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
