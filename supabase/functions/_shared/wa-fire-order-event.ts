// Server-side helper to fire wa-order-event as a safety net from payment
// webhooks / verifiers. Ensures order_confirmation WhatsApp is sent even if
// the shopper's browser tab was closed before notify-order could run.
//
// Best-effort, non-throwing — never block a webhook / verify response on it.
export async function fireWaOrderEvent(
  admin: any,
  orderId: string,
  event: "order_confirmation" | "order_shipped" = "order_confirmation",
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { data: cronRow } = await admin
      .from("cron_auth")
      .select("secret")
      .eq("id", true)
      .maybeSingle();
    const cronSecret = (cronRow as any)?.secret || Deno.env.get("CRON_SECRET") || "";
    if (!cronSecret) {
      console.warn("fireWaOrderEvent: no cron secret — skipping");
      return;
    }

    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const r = await fetch(`${supabaseUrl}/functions/v1/wa-order-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({ event, order_id: orderId }),
      });
      lastStatus = r.status;
      lastBody = await r.text().catch(() => "");
      if (r.ok) break;
      if (r.status !== 404 && r.status < 500) break;
      if (attempt < 3) await new Promise((res) => setTimeout(res, 400 * attempt));
    }
    console.log(`fireWaOrderEvent[${event}] ${orderId} status=${lastStatus} body=${lastBody}`);
  } catch (e) {
    console.error("fireWaOrderEvent error:", (e as Error).message);
  }
}
