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

    // Extract landmark from POI results
    let landmark = "";
    if (poiData.status === "OK" && poiData.results?.length) {
      const poi = poiData.results.find((r: any) =>
        r.types?.some((t: string) => ["point_of_interest", "establishment"].includes(t))
      );
      if (poi) {
        landmark = poi.address_components?.[0]?.long_name || "";
      }
    }

    const sublocality = get("sublocality_level_1") || get("sublocality") || get("neighborhood");
    const streetParts = [
      landmark ? `Near ${landmark}` : "",
      get("route") || get("sublocality_level_2"),
      sublocality,
    ].filter(Boolean);
    // Deduplicate
    const uniqueParts = [...new Set(streetParts)];

    const address = {
      street_address: uniqueParts.join(", ") || result.formatted_address?.split(",").slice(0, 2).join(",") || "",
      city: get("locality") || get("administrative_area_level_2"),
      state: get("administrative_area_level_1"),
      pincode: get("postal_code"),
    };

    return new Response(
      JSON.stringify({ success: true, address }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Geocoding failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
