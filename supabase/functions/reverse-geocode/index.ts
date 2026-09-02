const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const isPlusCode = (s: string) => /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i.test((s || "").trim());

async function timedFetch(url: string, init: RequestInit = {}, ms = 4500): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Per-IP rate limit: guest shoppers legitimately call this from checkout, so we
// cannot require a login — instead we cap Google Maps API spend per client.
const RL_MAX = 30; // calls
const RL_WINDOW_MS = 60 * 60 * 1000; // per hour

async function overRateLimit(req: Request): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return false;
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const admin = createClient(url, key, { auth: { persistSession: false } });

    const ip = (req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for") ||
      "unknown").split(",")[0].trim();
    const rlKey = `reverse-geocode:${ip}`;
    const windowStart = new Date(Date.now() - RL_WINDOW_MS).toISOString();

    const { data: rl } = await admin
      .from("edge_rate_limits")
      .select("key,count,window_start")
      .eq("key", rlKey)
      .maybeSingle();

    if (rl && rl.window_start > windowStart) {
      if ((rl.count ?? 0) >= RL_MAX) return true;
      await admin
        .from("edge_rate_limits")
        .update({ count: (rl.count ?? 0) + 1 })
        .eq("key", rlKey);
    } else {
      await admin
        .from("edge_rate_limits")
        .upsert({ key: rlKey, count: 1, window_start: new Date().toISOString() }, { onConflict: "key" });
    }
    return false;
  } catch {
    return false; // never break checkout on a rate-limit bookkeeping error
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (await overRateLimit(req)) {
      return new Response(
        JSON.stringify({ error: "Too many location lookups, please try again later" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { lat, lng, accuracy } = await req.json();


    if (typeof lat !== "number" || typeof lng !== "number" || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(
        JSON.stringify({ error: "Invalid coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Geocoding not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geoUrl = (lang: string) =>
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=${lang}&region=in`;

    // 1) English geocode (authoritative), 2) Hindi geocode (fills gaps),
    // 3) Places API (New) searchNearby ranked by DISTANCE for the real landmark.
    const [detailRes, hiRes, poiRes] = await Promise.all([
      timedFetch(geoUrl("en")),
      timedFetch(geoUrl("hi"), {}, 3000),
      timedFetch(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.displayName,places.location,places.primaryType",
          },
          body: JSON.stringify({
            maxResultCount: 5,
            rankPreference: "DISTANCE",
            languageCode: "en",
            locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 400 } },
          }),
        },
        3500,
      ),
    ]);

    const detailData = detailRes ? await detailRes.json() : null;

    if (!detailData || detailData.status !== "OK" || !detailData.results?.length) {
      return new Response(
        JSON.stringify({ error: "No address found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let results: any[] = detailData.results || [];
    // Prefer precise geometry over the APPROXIMATE locality that often sits at result[0]
    const rank = (r: any) => {
      const lt = r?.geometry?.location_type;
      return lt === "ROOFTOP" ? 0 : lt === "RANGE_INTERPOLATED" ? 1 : lt === "GEOMETRIC_CENTER" ? 2 : 3;
    };
    results = [...results].sort((a, b) => rank(a) - rank(b));

    // Merge Hindi results in as a fallback source for blank components
    let hiResults: any[] = [];
    try {
      const hiData = hiRes ? await hiRes.json() : null;
      if (hiData?.status === "OK") hiResults = hiData.results || [];
    } catch { /* best effort */ }

    const primary = results[0];

    const pickFrom = (list: any[], types: string[]): string => {
      for (const r of list) {
        for (const c of r.address_components || []) {
          if (types.some((t) => c.types?.includes(t))) {
            const v = String(c.long_name || "").trim();
            if (v && !isPlusCode(v)) return v;
          }
        }
      }
      return "";
    };
    const pick = (...types: string[]): string =>
      pickFrom(results, types) || pickFrom(hiResults, types);

    const city = pick("locality", "administrative_area_level_3", "administrative_area_level_2");
    const state = pick("administrative_area_level_1");
    const pincode = pick("postal_code");

    // Plot / house / premise numbers are intentionally NOT used — merchants asked
    // for landmark + society + village instead of a plot number.
    const premise = pick("premise");
    const society = premise && /(society|apartment|residency|enclave|colony|nagar|vihar|tower|heights|villa|park)/i.test(premise)
      ? premise
      : "";
    const route = pick("route");
    const subloc2 = pick("sublocality_level_2");
    const subloc1 = pick("sublocality_level_1", "sublocality");
    const neighborhood = pick("neighborhood");
    const village = pick("administrative_area_level_4", "administrative_area_level_5") ||
      (pick("locality") && pick("locality") !== city ? pick("locality") : "");

    // Nearest landmark with distance, from Places API (New)
    let landmark = "";
    let landmarkDistanceM: number | null = null;
    try {
      const poiData = poiRes ? await poiRes.json() : null;
      const places: any[] = poiData?.places || [];
      if (places.length) {
        const p = places[0];
        landmark = String(p?.displayName?.text || "").trim();
        const plat = p?.location?.latitude, plng = p?.location?.longitude;
        if (typeof plat === "number" && typeof plng === "number") {
          const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
          const dLat = toRad(plat - lat), dLng = toRad(plng - lng);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(plat)) * Math.sin(dLng / 2) ** 2;
          landmarkDistanceM = Math.round(2 * R * Math.asin(Math.sqrt(a)));
        }
      }
    } catch { /* landmark is best-effort */ }

    // Fallback: legacy POI geocode pass if Places returned nothing
    if (!landmark) {
      const fallbackPoi = await timedFetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}` +
        `&result_type=point_of_interest|establishment|premise|park|school|place_of_worship|transit_station` +
        `&language=en&region=in`,
        {},
        3000,
      );
      try {
        const d = fallbackPoi ? await fallbackPoi.json() : null;
        if (d?.status === "OK") {
          for (const r of d.results || []) {
            const name = String(r.address_components?.[0]?.long_name || "").trim();
            if (name && !isPlusCode(name)) { landmark = name; break; }
          }
        }
      } catch { /* ignore */ }
    }

    const parts = [society, route, subloc2, subloc1, neighborhood, village]
      .map((p) => (p || "").trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const unique = parts.filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k) || k === city.toLowerCase() || k === state.toLowerCase()) return false;
      seen.add(k);
      return true;
    });

    if (landmark && !seen.has(landmark.toLowerCase()) && landmark.toLowerCase() !== city.toLowerCase()) {
      unique.push(
        landmarkDistanceM !== null ? `Near ${landmark} (${landmarkDistanceM} m)` : `Near ${landmark}`
      );
    }

    if (unique.length === 0) {
      const fa = (primary.formatted_address || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter((p: string) =>
          !isPlusCode(p) && p.length > 1 && p.toLowerCase() !== city.toLowerCase() &&
          !/^(plot|h\.?\s?no\.?|house\s?no\.?)?\s*[\d\-\/]+[a-z]?$/i.test(p)
        );
      unique.push(...fa.slice(0, 2));
    }

    // Plus Code — a 10x14 m grid reference India Post / Delhivery both accept.
    // Appending it makes road-less rural addresses actually deliverable.
    const plusCode: string =
      String(detailData.plus_code?.compound_code || primary.plus_code?.compound_code || "").trim();
    const plusShort = plusCode ? plusCode.split(" ")[0] : "";
    const weakAddress = !route && !society && !subloc1 && !subloc2;
    if (plusShort && (weakAddress || unique.length <= 1)) {
      unique.push(`Plus Code ${plusShort}`);
    }

    const address = {
      street_address: unique.join(", "),
      city,
      state,
      pincode,
      landmark,
      landmark_distance_m: landmarkDistanceM,
      village,
      society,
      plus_code: plusShort,
      accuracy_m: typeof accuracy === "number" ? Math.round(accuracy) : null,
      precise: typeof accuracy === "number" ? accuracy <= 150 : null,
    };

    return new Response(
      JSON.stringify({ success: true, address }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Geocoding failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
