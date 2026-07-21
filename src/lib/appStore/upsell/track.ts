/**
 * Lightweight batched beacon for upsell_events.
 * Server writes via the `upsell-track` edge function (service_role).
 *
 * Client de-dupes events by (offerId+placement+productId+event_type) inside
 * a single session tick, and flushes every 5s or on `pagehide`.
 */
import { supabase } from "@/integrations/supabase/client";

type UpsellEventType = "view" | "click" | "add" | "purchase";

interface UpsellEvent {
  store_id: string;
  offer_id: string;
  placement: string;
  event_type: UpsellEventType;
  product_id?: string;
  order_id?: string;
  revenue_paise?: number;
  session_id?: string;
  meta?: Record<string, any>;
}

const QUEUE: UpsellEvent[] = [];
const SEEN = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function getSessionId(): string {
  try {
    let s = sessionStorage.getItem("sf_session_id");
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem("sf_session_id", s);
    }
    return s;
  } catch {
    return "anon";
  }
}

async function flush() {
  timer = null;
  if (!QUEUE.length) return;
  const batch = QUEUE.splice(0, QUEUE.length);
  try {
    await supabase.functions.invoke("upsell-track", { body: { events: batch } });
  } catch {
    /* silent — analytics only */
  }
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, 5000);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (QUEUE.length) void flush();
  });
}

export function trackUpsell(evt: UpsellEvent) {
  const key = `${evt.event_type}:${evt.offer_id}:${evt.placement}:${evt.product_id || ""}`;
  // De-dupe views/clicks within a session; adds/purchases always fire.
  if ((evt.event_type === "view" || evt.event_type === "click") && SEEN.has(key)) return;
  SEEN.add(key);
  QUEUE.push({ ...evt, session_id: evt.session_id || getSessionId() });
  schedule();
}