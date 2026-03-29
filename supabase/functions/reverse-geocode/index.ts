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

    if (typeof lat !== "number" || typeof lng !== "number") {
      return new Response(
        JSON.stringify({ error: "lat and lng required" }),
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

    // Fetch landmark/neighborhood info from Google
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=point_of_interest|establishment|neighborhood|sublocality|locality`;
    const geoRes = await fetch(url);
    const geoData = await geoRes.json();

    let landmark = "";

    if (geoData.status === "OK" && geoData.results?.length) {
      const poiResult = geoData.results.find((r: any) =>
        r.types?.some((t: string) => ["point_of_interest", "establishment", "premise"].includes(t))
      );
      const neighborhoodResult = geoData.results.find((r: any) =>
        r.types?.some((t: string) => ["neighborhood", "sublocality_level_1", "sublocality"].includes(t))
      );

      const bestResult = poiResult || neighborhoodResult || geoData.results[0];
      const components = bestResult.address_components || [];

      const get = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name || "";

      const poi = poiResult ? components[0]?.long_name || "" : "";
      const area = get("sublocality_level_1") || get("sublocality") || get("neighborhood");

      const parts = [poi, area].filter(Boolean);
      // Deduplicate
      landmark = [...new Set(parts)].join(", ");
    }

    return new Response(
      JSON.stringify({ success: true, landmark }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Geocoding failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
