import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const PHONE_NUMBER_ID = '1248148541706026';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('WA_ACCESS_TOKEN')!;
    const { to = '919827582350', template = 'hello_world', lang = 'en_US' } = await req.json().catch(() => ({}));

    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: template, language: { code: lang } },
      }),
    });
    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: res.ok ? 200 : 400,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
