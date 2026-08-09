const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const isPlusCode = (s: string) => /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i.test((s || "").trim());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lat, lng } = await req.json();

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

    const geoUrl =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en&region=in`;
    // Fire the landmark/POI lookup in parallel — rural Indian coords almost always
    // need it (plain geocode returns only the village name, e.g. "Lingipur").
    const poiUrl =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}` +
      `&result_type=point_of_interest|establishment|premise|park|school|place_of_worship|transit_station` +
      `&language=en&region=in`;

    const [detailRes, poiRes] = await Promise.all([
      fetch(geoUrl),
      fetch(poiUrl).catch(() => null as unknown as Response),
    ]);
    const detailData = await detailRes.json();

    if (detailData.status !== "OK" || !detailData.results?.length) {
      return new Response(
        JSON.stringify({ error: "No address found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = detailData.results || [];
    const primary = results[0];

    // Pull the first non-pluscode value of a component type across ALL results,
    // so village / road / sublocality survive even when the top result is sparse.
    const pick = (...types: string[]): string => {
      for (const r of results) {
        for (const c of r.address_components || []) {
          if (types.some((t) => c.types?.includes(t))) {
            const v = String(c.long_name || "").trim();
            if (v && !isPlusCode(v)) return v;
          }
        }
      }
      return "";
    };

    const city = pick("locality", "administrative_area_level_3", "administrative_area_level_2");
    const state = pick("administrative_area_level_1");
    const pincode = pick("postal_code");

    // Plot / house / premise numbers are intentionally NOT used — merchants asked
    // for landmark + society + village instead of a plot number.
    const society = pick("premise") && /(society|apartment|residency|enclave|colony|nagar|vihar|tower|heights|villa|park)/i.test(pick("premise"))
      ? pick("premise")
      : "";
    const route = pick("route");
    const subloc2 = pick("sublocality_level_2");
    const subloc1 = pick("sublocality_level_1", "sublocality");
    const neighborhood = pick("neighborhood");
    // Village: level_4/5 in rural India, or the locality when it differs from the district city
    const village = pick("administrative_area_level_4", "administrative_area_level_5") ||
      (pick("locality") && pick("locality") !== city ? pick("locality") : "");

    // Nearest landmark from the POI pass
    let landmark = "";
    try {
      const poiData = poiRes ? await poiRes.json() : null;
      if (poiData?.status === "OK") {
        for (const r of poiData.results || []) {
          const name = String(r.address_components?.[0]?.long_name || "").trim();
          if (name && !isPlusCode(name)) { landmark = name; break; }
        }
      }
    } catch { /* landmark is best-effort */ }

    const parts = [
      premise,
      route,
      subloc2,
      subloc1,
      neighborhood,
      village,
    ]
      .map((p) => (p || "").trim())
      .filter(Boolean);

    // De-dupe case-insensitively while keeping order
    const seen = new Set<string>();
    const unique = parts.filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k) || k === city.toLowerCase() || k === state.toLowerCase()) return false;
      seen.add(k);
      return true;
    });

    // Always append the landmark when it adds new information — this is what
    // makes rural addresses actually deliverable.
    if (landmark && !seen.has(landmark.toLowerCase()) && landmark.toLowerCase() !== city.toLowerCase()) {
      unique.push(`Near ${landmark}`);
    }

    if (unique.length === 0) {
      const fa = (primary.formatted_address || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter((p: string) => !isPlusCode(p) && p.length > 1 && p.toLowerCase() !== city.toLowerCase());
      unique.push(...fa.slice(0, 2));
    }

    const address = {
      street_address: unique.join(", "),
      city,
      state,
      pincode,
      landmark,
      village,
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
