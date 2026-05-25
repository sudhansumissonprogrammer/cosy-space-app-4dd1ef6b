// Returns the server's VAPID public key so the client can subscribe with the
// exact same key the server signs with. Prevents 403 "VAPID credentials do
// not correspond" errors caused by key drift.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const key = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  return new Response(JSON.stringify({ key }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
