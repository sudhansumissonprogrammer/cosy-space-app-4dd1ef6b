/**
 * migration-status — Poll a job's progress and recent errors.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    let jobId = new URL(req.url).searchParams.get("job_id");
    if (!jobId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      jobId = body.job_id || null;
    }
    if (!jobId) return json({ error: "job_id required" }, 400);

    const { data, error } = await supa
      .from("migration_jobs")
      .select("id,store_id,source_platform,detected_platform,source_url,entities,status,progress,discovered_counts,error_log,created_at,started_at,completed_at,cancel_requested")
      .eq("id", jobId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!data) return json({ error: "Not found" }, 404);

    const isStalled =
      (data.status === "running" || data.status === "pending") &&
      !data.cancel_requested &&
      data.completed_at === null &&
      Date.now() - new Date(data.started_at ?? data.created_at).getTime() > 5 * 60 * 1000;

    if (isStalled) {
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      const base = Deno.env.get("SUPABASE_URL");
      if (service && base) {
        fetch(`${base}/functions/v1/migration-worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${service}`,
          },
          body: JSON.stringify({ job_id: data.id }),
        }).catch(() => {});
      }
    }

    return json({ job: data, resumed: isStalled });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
