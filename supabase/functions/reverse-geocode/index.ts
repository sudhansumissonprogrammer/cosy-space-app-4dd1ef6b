const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Fetch detailed address + landmark/POI in parallel
    const [detailRes, poiRes] = await Promise.all([
      fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`),
      fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=point_of_interest|establishment|neighborhood|sublocality`),
    ]);

    const [detailData, poiData] = await Promise.all([detailRes.json(), poiRes.json()]);

    if (detailData.status !== "OK" || !detailData.results?.length) {
      return new Response(
        JSON.stringify({ error: "No address found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = detailData.results[0];
    const components = result.address_components || [];
    const get = (type: string) =>
      components.find((c: any) => c.types.includes(type))?.long_name || "";

    // Helper: detect plus codes like "6RFV+3QR" or "XXXX+XX"
    const isPlusCode = (s: string) => /^[A-Z0-9]{4,}\+[A-Z0-9]{2,}$/i.test(s.trim());

    // Extract landmark from POI results (skip plus codes)
    let landmark = "";
    if (poiData.status === "OK" && poiData.results?.length) {
      for (const r of poiData.results) {
        const hasPoi = r.types?.some((t: string) =>
          ["point_of_interest", "establishment", "neighborhood", "sublocality"].includes(t)
        );
        if (hasPoi) {
          // Try formatted_address first part for a readable name
          const name = r.address_components?.[0]?.long_name || "";
          if (name && !isPlusCode(name)) {
            landmark = name;
            break;
          }
        }
      }
    }

    // Also scan detail results for neighborhood/village names
    const allResults = detailData.results || [];
    let villageName = "";
    let areaName = "";
    for (const r of allResults) {
      for (const comp of (r.address_components || [])) {
        if (!villageName && comp.types?.includes("locality") && !isPlusCode(comp.long_name)) {
          // skip, we use this for city
        }
        if (!villageName && (comp.types?.includes("sublocality_level_1") || comp.types?.includes("neighborhood")) && !isPlusCode(comp.long_name)) {
          villageName = comp.long_name;
        }
        if (!areaName && (comp.types?.includes("sublocality_level_2") || comp.types?.includes("sublocality")) && !isPlusCode(comp.long_name)) {
          areaName = comp.long_name;
        }
      }
    }

    const route = get("route");
    const sublocality = get("sublocality_level_1") || get("sublocality") || get("neighborhood");

    // Build street address: prioritize landmark/area/village, filter plus codes
    const streetParts = [
      landmark ? `Near ${landmark}` : "",
      route && !isPlusCode(route) ? route : "",
      areaName && areaName !== landmark && areaName !== sublocality ? areaName : "",
      villageName && villageName !== landmark && villageName !== areaName ? villageName : "",
      sublocality && sublocality !== villageName && sublocality !== areaName && sublocality !== landmark ? sublocality : "",
    ].filter(Boolean);

    // Deduplicate
    const uniqueParts = [...new Set(streetParts)];

    // Fallback: use formatted_address but strip plus codes
    let fallbackAddress = "";
    if (uniqueParts.length === 0) {
      const parts = (result.formatted_address || "").split(",").map((s: string) => s.trim());
      const cleanParts = parts.filter((p: string) => !isPlusCode(p) && p.length > 1).slice(0, 2);
      fallbackAddress = cleanParts.join(", ");
    }

    const address = {
      street_address: uniqueParts.join(", ") || fallbackAddress || "",
      city: get("locality") || get("administrative_area_level_2"),
      state: get("administrative_area_level_1"),
      pincode: get("postal_code"),
    };

    return new Response(
      JSON.stringify({ success: true, address }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Cache repeat lat/lng lookups for 1 hour at the edge so users
          // who re-detect their location don't pay the round-trip cost twice.
          // 'public' is safe — geocoding results aren't user-specific.
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
