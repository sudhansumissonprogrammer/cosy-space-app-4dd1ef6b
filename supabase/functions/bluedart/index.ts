// Blue Dart edge function — merchant-facing helper used by the Shipping
// Integrations screen ("Test credentials") and by ad-hoc AWB lookups.
// Shipment tracking during normal operation runs through `shipment-track`,
// which uses the same adapter in _shared/tracking/couriers/bluedart.ts.

import { authedUser, assertStoreOwner, loadProvider, corsHeaders, json } from "../_shared/shipping.ts";
import { bluedartTrackWithCreds } from "../_shared/tracking/couriers/bluedart.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await authedUser(req);
    if (!user) return json({ error: "unauthorized" }, 401);

    const { action, store_id, awb } = await req.json();
    if (!store_id) return json({ error: "store_id required" }, 400);
    await assertStoreOwner(user.id, store_id);

    const cfg = await loadProvider(store_id, "bluedart");
    const creds = {
      loginId: cfg.client_id,
      licenceKey: cfg.api_key,
      gatewayClientId: cfg.api_email,
      gatewayClientSecret: cfg.api_secret,
    };

    if (action === "track" || action === "test") {
      // "test" reuses a track call with the merchant's own sample AWB; Blue Dart
      // has no ping endpoint, so a licence error is the signal we look for.
      const number = String(awb ?? "").trim();
      if (!number) return json({ error: "Enter a Blue Dart AWB / waybill number to test" }, 400);
      const tracking = await bluedartTrackWithCreds(number, creds, null);
      return json({ ok: true, tracking });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});
