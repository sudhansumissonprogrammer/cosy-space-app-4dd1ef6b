// Hourly cron: links recent orders to platform-sent abandoned-cart messages
// so the analytics tab can show recovered orders + recovered revenue.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, isValidCronHeader } from "../_shared/wa-platform.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const cronHeader = req.headers.get("x-cron-secret") || "";
  if (!(await isValidCronHeader(admin, cronHeader))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data, error } = await admin.rpc("attribute_wa_recovery" as any);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  return new Response(JSON.stringify({ attributed: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
