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
    const apiKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Geocoding not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP from headers
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    if (!clientIp || clientIp === "unknown") {
      return new Response(
        JSON.stringify({ error: "Could not determine location" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: IP geolocation (free, no key needed, ~50ms)
    const ipRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,lat,lon,city,regionName,zip`);
    const ipData = await ipRes.json();

    if (ipData.status !== "success" || !ipData.lat || !ipData.lon) {
      return new Response(
        JSON.stringify({ error: "Could not determine location from IP" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Google reverse geocode for detailed address with landmarks
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${ipData.lat},${ipData.lon}&key=${apiKey}&result_type=point_of_interest|establishment|neighborhood|sublocality|locality`;
    const geoRes = await fetch(url);
    const geoData = await geoRes.json();

    let landmark = "";
    let streetAddress = "";

    if (geoData.status === "OK" && geoData.results?.length) {
      // Find a landmark/POI result first
      const poiResult = geoData.results.find((r: any) =>
        r.types?.some((t: string) => ["point_of_interest", "establishment", "premise"].includes(t))
      );
      const neighborhoodResult = geoData.results.find((r: any) =>
        r.types?.some((t: string) => ["neighborhood", "sublocality_level_1", "sublocality"].includes(t))
      );
      const localityResult = geoData.results.find((r: any) =>
        r.types?.includes("locality")
      );

      const bestResult = poiResult || neighborhoodResult || localityResult || geoData.results[0];
      const components = bestResult.address_components || [];

      const get = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name || "";

      landmark = poiResult
        ? components[0]?.long_name || ""
        : get("neighborhood") || get("sublocality_level_1") || get("sublocality");

      const area = get("sublocality_level_1") || get("sublocality") || get("neighborhood");
      streetAddress = [landmark, area].filter(Boolean).join(", ");
      // Deduplicate if landmark === area
      if (landmark && landmark === area) streetAddress = landmark;
    }

    const city = ipData.city || "";
    const state = ipData.regionName || "";
    const pincode = ipData.zip || "";

    return new Response(
      JSON.stringify({
        success: true,
        address: {
          street_address: streetAddress || `Near ${city}`,
          city,
          state,
          pincode,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Geocoding failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
