import { Link } from "react-router-dom";
import { ChevronRight, Package } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";
import { getOrderStatusMeta } from "@/lib/orderStatus";
import { currencySymbol } from "@/lib/productUtils";

let detailChunkLoaded = false;
const prefetchOrderDetail = () => {
  if (detailChunkLoaded) return;
  detailChunkLoaded = true;
  import("@/pages/StorefrontOrderDetail").catch(() => { detailChunkLoaded = false; });
};

const subtitle = (status: string, createdAt: string) => {
  const d = new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  switch (status) {
    case "delivered":      return `Delivered`;
    case "shipped":        return `Arriving soon`;
    case "rto":            return `Returned to seller`;
    case "cancelled":      return `Cancelled`;
    case "confirmed":      return `Order confirmed`;
    case "partially_paid": return `Advance received`;
    default:               return `Placed on ${d}`;
  }
};

export default function OrderCard({ order, storeSlug, currency }: { order: any; storeSlug: string; currency: string }) {
  const items = order.order_items || [];
  const first = items[0];
  const firstImg = first?.products?.image_url || first?.image_url;
  const more = items.length - 1;
  const meta = getOrderStatusMeta(order.status);
  const orderShort = order.order_number ? `#${1000 + order.order_number}` : `#${order.id.slice(0, 8).toUpperCase()}`;

  return (
    <Link
      to={storefrontPath(storeSlug, `account/orders/${order.id}`)}
      onMouseEnter={prefetchOrderDetail}
      onTouchStart={prefetchOrderDetail}
      className="group block rounded-2xl border bg-card p-3 transition-[transform,opacity,colors,box-shadow] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
      style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          {firstImg ? (
            <img src={firstImg} alt={first?.product_name} loading="lazy"
                 className="h-16 w-16 rounded-xl object-cover border"
                 style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }} />
          ) : (
            <div className="h-16 w-16 rounded-xl flex items-center justify-center border"
                 style={{ borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
              <Package className="h-6 w-6 opacity-40" />
            </div>
          )}
          {more > 0 && (
            <span className="absolute -bottom-1 -right-1 rounded-full bg-foreground text-background text-[10px] font-bold px-1.5 py-0.5 leading-none">
              +{more}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            <span className="text-[11px] truncate" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
              {orderShort}
            </span>
          </div>
          <p className="mt-1 text-sm font-medium line-clamp-1">
            {first?.product_name || "Order"}
            {more > 0 && <span className="font-normal opacity-60"> + {more} more</span>}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
            {subtitle(order.status, order.created_at)} · {currencySymbol(currency)}{Number(order.total).toFixed(0)}
          </p>
        </div>

        <ChevronRight className="h-5 w-5 shrink-0 opacity-40 group-hover:opacity-80 group-hover:translate-x-0.5 transition-[transform,opacity,colors,box-shadow]" />
      </div>
    </Link>
  );
}
