import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { metaFetch } from '../_shared/wa-platform.ts';

const PHONE_NUMBER_ID = '1248148541706026';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = Deno.env.get('WA_ACCESS_TOKEN')!;
    const { to = '919827582350', text } = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = text
      ? { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: '✅ ShopBanao WhatsApp is LIVE!\n\nThis is a live test from your business number (+91 98275 82350) via Meta Cloud API.\n\n— Powered by shopbanao.in' },
        };

    const res = await metaFetch(admin, `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, { source: 'wa-send-test' });
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, data: res.body }), {
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
