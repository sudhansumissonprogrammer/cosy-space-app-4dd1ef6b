// Server-side pincode → city/state lookup.
// Public function (no auth) — used by checkout to autofill city/state when the
// browser cannot reach postalpincode.in / zippopotam.us directly.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const pin = (url.searchParams.get('pincode') || '').trim();
  if (!/^\d{6}$/.test(pin)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_pincode' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const tryPrimary = async () => {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const j = await r.json();
    const po = j?.[0]?.PostOffice?.[0];
    if (!po) throw new Error('no post office');
    return { city: String(po.District || ''), state: String(po.State || '') };
  };
  const tryFallback = async () => {
    const r = await fetch(`https://api.zippopotam.us/in/${pin}`);
    const j = await r.json();
    const p = j?.places?.[0];
    if (!p) throw new Error('no place');
    return { city: String(p['place name'] || ''), state: String(p['state'] || '') };
  };

  let result: { city: string; state: string } | null = null;
  try { result = await tryPrimary(); } catch { /* try fallback */ }
  if (!result) { try { result = await tryFallback(); } catch { /* silent */ } }

  if (!result || (!result.city && !result.state)) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 404,
    });
  }

  return new Response(JSON.stringify({ ok: true, city: result.city, state: result.state }), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=86400',
    },
    status: 200,
  });
});
