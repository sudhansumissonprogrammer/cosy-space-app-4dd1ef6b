// Server-side pincode → city/state lookup.
// Public function (no auth) — used by checkout to autofill city/state when the
// browser cannot reach postalpincode.in / zippopotam.us directly.
//
// Hardening (Aug 2026): the upstream providers (esp. api.postalpincode.in)
// intermittently stall for 30s+. Previously we awaited them with no timeout,
// so the whole edge function hung and the uptime monitor flagged the entire
// "Edge functions gateway" as DOWN. Now:
//   - every upstream call has a hard 2.5s AbortController timeout
//   - both providers are raced in parallel (first good answer wins)
//   - results are memoised in-module (warm isolates answer in ~0ms)
//   - the whole handler is wrapped in a 4s budget and always responds
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const UPSTREAM_TIMEOUT_MS = 2500;
const TOTAL_BUDGET_MS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface Info { city: string; state: string }
const cache = new Map<string, { info: Info | null; at: number }>();

const json = (body: unknown, status = 200, cacheSecs = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(cacheSecs ? { 'Cache-Control': `public, max-age=${cacheSecs}` } : {}),
    },
  });

async function timedFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function viaPostal(pin: string): Promise<Info> {
  const r = await timedFetch(`https://api.postalpincode.in/pincode/${pin}`);
  const j = await r.json();
  const po = j?.[0]?.PostOffice?.[0];
  if (!po) throw new Error('no post office');
  return { city: String(po.District || ''), state: String(po.State || '') };
}

async function viaZippo(pin: string): Promise<Info> {
  const r = await timedFetch(`https://api.zippopotam.us/in/${pin}`);
  const j = await r.json();
  const p = j?.places?.[0];
  if (!p) throw new Error('no place');
  return { city: String(p['place name'] || ''), state: String(p['state'] || '') };
}

/**
 * Both providers are STARTED in parallel (so nothing is serialised), but
 * postalpincode.in is PREFERRED because it returns the real district name,
 * while zippopotam returns the locality. Zippo is only used when postal
 * fails or times out — and by then it has already resolved.
 */
async function raceProviders(pin: string): Promise<Info | null> {
  const ok = (info: Info) => {
    if (!info.city && !info.state) throw new Error('empty');
    return info;
  };
  const postal = viaPostal(pin).then(ok);
  const zippo = viaZippo(pin).then(ok);
  // Prevent unhandled rejection if postal wins and zippo later fails.
  zippo.catch(() => {});
  try {
    return await postal;
  } catch {
    try {
      return await zippo;
    } catch {
      return null;
    }
  }
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const pin = (url.searchParams.get('pincode') || '').trim();
  if (!/^\d{6}$/.test(pin)) return json({ ok: false, error: 'invalid_pincode' }, 400);

  const hit = cache.get(pin);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.info
      ? json({ ok: true, city: hit.info.city, state: hit.info.state, cached: true }, 200, 86400)
      : json({ ok: false, error: 'not_found', cached: true }, 200);
  }

  // Hard overall budget — never let a stalled upstream hang the gateway.
  const budget = new Promise<null>((resolve) => setTimeout(() => resolve(null), TOTAL_BUDGET_MS));
  const result = await Promise.race([raceProviders(pin), budget]);

  if (!result) {
    // Do not cache timeouts/misses as permanent — short-lived negative entry only.
    cache.set(pin, { info: null, at: Date.now() - (CACHE_TTL_MS - 60_000) });
    // 200 + ok:false: "not found / temporarily unavailable" is a normal negative
    // result, not an error. Non-2xx here trips global error handlers + uptime alerts.
    return json({ ok: false, error: 'not_found' }, 200);
  }

  cache.set(pin, { info: result, at: Date.now() });
  return json({ ok: true, city: result.city, state: result.state }, 200, 86400);
});
