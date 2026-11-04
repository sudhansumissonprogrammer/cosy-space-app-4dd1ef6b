import { Link, useOutletContext } from "react-router-dom";
import { useBundleMenu } from "@/hooks/useBundleMenu";
import { storefrontPath } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";
import { Package } from "lucide-react";

type StoreData = Tables<"stores">;

export default function BundlesIndexPage() {
  const store = useOutletContext<StoreData>();
  const { data: bundles, isLoading } = useBundleMenu(store?.slug);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="h-8 w-56 bg-muted rounded animate-pulse mb-6" />
        <div className="space-y-4">
          <div className="h-56 bg-muted rounded-xl animate-pulse" />
          <div className="h-56 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!bundles || bundles.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Package className="h-7 w-7 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
          No bundles yet
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Check back soon for combo offers.</p>
        <Link
          to={storefrontPath(store.slug)}
          className="mt-6 inline-flex items-center justify-center rounded-md px-5 py-2 text-sm font-semibold"
          style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))", color: "var(--storefront-primary-foreground, #fff)" }}
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const currency = (store.currency as string) || "INR";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  return (
    <div
      className="storefront-font min-h-[70vh] px-4 pb-24 pt-6 md:pt-10"
      style={{ backgroundColor: "var(--storefront-bg, transparent)", color: "var(--storefront-text, inherit)" }}
    >
      <div className="mx-auto max-w-3xl">
        <h1
          className="text-center text-3xl md:text-4xl font-bold tracking-tight mb-8"
          style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
        >
          Make Your Own Combo
        </h1>

        <div className="space-y-5">
          {bundles.map((b) => (
            <article
              key={b.id}
              className="rounded-2xl border p-3 md:p-4"
              style={{
                borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 92%, transparent)",
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="text-lg md:text-xl font-bold" style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}>
                  {b.name}
                </h2>
                <p className="text-lg md:text-xl font-bold whitespace-nowrap">
                  {symbol}{Number(b.bundle_price).toLocaleString("en-IN", { useGrouping: false })}
                </p>
              </div>

              {b.banner_url ? (
                <Link to={storefrontPath(store.slug, `bundles/${b.slug}`)} className="block">
                  <img
                    src={b.banner_url}
                    alt={b.name}
                    className="w-full h-48 md:h-64 object-cover rounded-xl"
                    loading="lazy"
                  />
                </Link>
              ) : (
                <Link
                  to={storefrontPath(store.slug, `bundles/${b.slug}`)}
                  className="flex h-40 md:h-56 w-full items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 via-rose-100 to-pink-100"
                >
                  <div className="text-center">
                    <p className="text-2xl md:text-3xl font-extrabold text-slate-800">
                      Pick {b.pick_count} @ {symbol}{Number(b.bundle_price).toLocaleString("en-IN", { useGrouping: false })}
                    </p>
                    <p className="text-xs md:text-sm text-slate-600 mt-1">NO CODE NEEDED. LIMITED TIME ONLY.</p>
                  </div>
                </Link>
              )}

              {b.subheading && (
                <p className="mt-3 text-sm text-center text-muted-foreground">{b.subheading}</p>
              )}

              <Link
                to={storefrontPath(store.slug, `bundles/${b.slug}`)}
                className="mt-3 md:mt-4 block w-full rounded-xl px-4 py-3 md:py-3.5 text-center text-sm font-bold uppercase tracking-wide transition-transform active:scale-[0.98]"
                style={{
                  background: "linear-gradient(180deg, #E4C170 0%, #C9A15A 100%)",
                  color: "#111",
                }}
              >
                Make Your {b.name.replace(/^(get|pick)\s+\d+\s+/i, "").split("@")[0].trim() || "Combo"} Now
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}