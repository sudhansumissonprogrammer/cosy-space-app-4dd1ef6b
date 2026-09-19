import { useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, MapPin, PackageCheck } from "lucide-react";
import {
  SHIPMENT_STATUS_LABEL, SHIPMENT_STEPS, courierMeta, isTerminal,
  aggregatorTrackingUrl, shipmentStatusRank, type ShipmentStatus,
} from "@/lib/shipping/courierRegistry";
import type { ShipmentTracking } from "@/hooks/useShipmentTracking";
import CourierLogo from "./CourierLogo";
import { trackingAvailability, trackingUnavailableMessage } from "@/lib/shipping/trackingAvailability";

const softText = "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)";
const softBorder = "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)";
const accent = "var(--storefront-primary, hsl(var(--primary)))";

function statusTone(s: ShipmentStatus) {
  if (s === "delivered") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  if (s === "cancelled" || s === "returned") return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (s === "exception") return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  if (s === "out_for_delivery") return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
  return "bg-muted text-foreground";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
/** "just now" / "12 min ago" / "3 hr ago" — keeps the freshness obvious. */
function fmtAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export default function ShipmentTimeline({ shipment }: { shipment: ShipmentTracking }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const meta = courierMeta(shipment.tracking_slug || shipment.provider);
  const courierName = shipment.courier_name || meta.name;
  const status = shipment.status;
  const currentIdx = shipmentStatusRank(status);
  const failed = status === "cancelled" || status === "returned";
  const slug = shipment.tracking_slug || shipment.provider;
  const official = shipment.awb ? aggregatorTrackingUrl(shipment.awb) : null;

  const events = shipment.events ?? [];
  const availability = trackingAvailability(shipment.last_error);
  const hasCourierScans = events.some((event) => !!event.location);
  const visible = expanded ? events : events.slice(0, 4);
  // Manual merchant updates ("status updated by seller") are stamped with the
  // save time, so they can sit above the courier's own scans. Anything shown
  // as "where the parcel is" must come from a real scan.
  const latest = events.find((e) => !!e.location) ?? events[0];
  const deliveredAt = events.find((e) => e.status === "delivered")?.event_time;


  const copy = async () => {
    if (!shipment.awb) return;
    try {
      await navigator.clipboard.writeText(shipment.awb);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: softBorder }}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CourierLogo slug={shipment.tracking_slug || shipment.provider} size={38} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold capitalize">{courierName}</p>
            {shipment.awb && (
              <button type="button" onClick={copy}
                      className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono"
                      style={{ color: softText }}>
                {shipment.awb}
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(status)}`}>
          {SHIPMENT_STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {status === "delivered" && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <PackageCheck className="h-4 w-4 shrink-0" />
          <p className="text-xs font-semibold">
            Delivered{deliveredAt ? ` on ${fmtDate(deliveredAt)}` : ""}
          </p>
        </div>
      )}

      {availability === "temporarily_unavailable" && !isTerminal(status) && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-relaxed">{trackingUnavailableMessage(hasCourierScans)}</p>
        </div>
      )}

      {/* ETA + latest checkpoint */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {shipment.estimated_delivery && status !== "delivered" && !failed && (
          <div className="rounded-xl px-3 py-2" style={{ background: "color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 8%, transparent)" }}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: softText }}>Estimated delivery</p>
            <p className="text-sm font-semibold">{fmtDate(shipment.estimated_delivery)}</p>
          </div>
        )}
        {(latest?.location || shipment.current_location) && (
          <div className="rounded-xl px-3 py-2" style={{ background: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 5%, transparent)" }}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: softText }}>Last location</p>
            <p className="flex items-center gap-1 text-sm font-medium">
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate">{latest?.location || shipment.current_location}</span>
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!failed && (
        <div className="mt-4 flex items-start gap-1">
          {SHIPMENT_STEPS.map((step, i) => {
            const done = i <= currentIdx;
            return (
              <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex w-full items-center">
                  <span className="h-1.5 w-full rounded-full transition-colors"
                        style={{ background: done ? accent : softBorder }} />
                </div>
                <span className="text-center text-[9px] leading-tight sm:text-[10px]"
                      style={{ color: done ? "inherit" : softText, fontWeight: i === currentIdx ? 700 : 400 }}>
                  {SHIPMENT_STATUS_LABEL[step].replace("Order ", "")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Event timeline */}
      {events.length > 0 && (
        <div className="mt-5">
          <ol className="relative space-y-4 pl-5">
            <span className="absolute left-[5px] top-1.5 bottom-1.5 w-px" style={{ background: softBorder }} />
            {visible.map((e, i) => (
              <li key={`${e.event_time}-${i}`} className="relative">
                <span className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full"
                      style={{ background: i === 0 ? accent : softBorder }} />
                <p className="text-[13px] font-medium leading-snug">
                  {e.description || SHIPMENT_STATUS_LABEL[e.status] || e.status}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: softText }}>
                  {fmtDate(e.event_time)} · {fmtTime(e.event_time)}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </li>
            ))}
          </ol>
          {events.length > 4 && (
            <button type="button" onClick={() => setExpanded((v) => !v)}
                    className="mt-3 text-xs font-semibold" style={{ color: accent }}>
              {expanded ? "Show less" : `View all ${events.length} updates`}
            </button>
          )}
        </div>
      )}

      {events.length === 0 && (
        <p className="mt-4 text-xs" style={{ color: softText }}>
          {isTerminal(status)
            ? "No further updates for this shipment."
            : "Tracking updates will appear here as soon as the courier scans your parcel."}
        </p>
      )}

      {shipment.last_synced_at && (
        <p className="mt-3 text-[11px]" style={{ color: softText }}>
          {availability === "live" ? "Updated" : "Last checked"} {fmtAgo(shipment.last_synced_at)} · {courierName}
        </p>
      )}

      {official && (
        <a href={official} target="_blank" rel="noopener noreferrer"
           className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
           style={{ borderColor: softBorder }}>
          Track on 17TRACK <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
