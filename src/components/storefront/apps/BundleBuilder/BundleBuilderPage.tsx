import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBundleBySlug } from "@/hooks/useBundleMenu";
import { useCart } from "@/contexts/CartContext";
import { storefrontPath } from "@/lib/subdomain";
import type { Tables } from "@/integrations/supabase/types";
import type { BundleChild } from "@/lib/appStore/bundle/types";
import { bundleTypeOf } from "@/lib/appStore/bundle/types";
import FixedBundleCard from "./FixedBundleCard";
import { Loader2, Minus, Plus, X, Zap, Star } from "lucide-react";
import { toast } from "sonner";

type StoreData = Tables<"stores">;

interface PoolProduct {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  category: string | null;
  stock_quantity: number | null;
  is_best_selling: boolean | null;
}

// Small deterministic tag helper — Best Seller / Trending / New Arrival etc.
function getTag(p: PoolProduct, i: number): string | null {
  if (p.is_best_selling) return "Best Seller";
  const tags = ["Trending", "Summer Special", "New Arrival", "Popular"];
  // Deterministic per product id so tags don't flicker between renders.
  let h = 0;
  for (let k = 0; k < (p.id || "").length; k++) h = ((h << 5) - h) + p.id.charCodeAt(k);
  return tags[Math.abs(h) % tags.length];
}

export default function BundleBuilderPage() {
  const store = useOutletContext<StoreData>();
  const { bundleSlug } = useParams<{ bundleSlug: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const { bundle, isLoading: bundleLoading } = useBundleBySlug(store?.slug, bundleSlug);

  // Prevent double-adds if the user rapid-taps "Order Combo" (touch devices
  // often fire two clicks). Also protects against the button being re-clicked
  // during the navigate() transition.
  const [submitting, setSubmitting] = useState(false);

  const { data: products, isLoading: prodLoading } = useQuery({
    queryKey: ["bundle-pool", store?.id, bundle?.id],
    enabled: !!store?.id && !!bundle,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id,slug,name,price,sale_price,image_url,category,stock_quantity,is_best_selling")
        .eq("store_id", store!.id)
        .eq("is_active", true)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as PoolProduct[];
    },
  });

  // Selection: array of product ids (allows duplicates up to pick_count)
  const [selection, setSelection] = useState<string[]>([]);

  // Reset selection when navigating bundles
  useEffect(() => { setSelection([]); }, [bundle?.id]);

  const eligible = useMemo<PoolProduct[]>(() => {
    if (!products || !bundle) return [];
    const excludeSet = new Set(bundle.exclude_product_ids);
    const includeCats = new Set(bundle.include_categories);
    const manualIn = new Set(bundle.include_product_ids);
    return products.filter((p) => {
      if (excludeSet.has(p.id)) return false;
      if ((p.stock_quantity ?? 1) <= 0) return false;
      if (includeCats.size === 0) return true;
      if (p.category && includeCats.has(p.category)) return true;
      if (manualIn.has(p.id)) return true;
      return false;
    });
  }, [products, bundle]);

  if (bundleLoading || (!bundle && !bundleLoading)) {
    if (bundleLoading) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Bundle not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This bundle may have been removed.</p>
        <Link
          to={storefrontPath(store.slug, "bundles")}
          className="mt-6 inline-flex items-center justify-center rounded-md border px-5 py-2 text-sm font-semibold"
        >
          View all bundles
        </Link>
      </div>
    );
  }

  // v2 dispatch: fixed and fbt bundles use FixedBundleCard.
  // Placed after all hooks so React hook order stays stable across bundle
  // switches (pick_n <-> fixed <-> fbt).
  if (bundle && bundleTypeOf(bundle) !== "pick_n") {
    return <FixedBundleCard store={store} bundle={bundle} />;
  }

  const currency = (store.currency as string) || "INR";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
  const N = bundle!.pick_count;

  const selectedCounts = new Map<string, number>();
  for (const id of selection) selectedCounts.set(id, (selectedCounts.get(id) ?? 0) + 1);

  const totalSelected = selection.length;
  const complete = totalSelected === N;

  const remaining = N - totalSelected;

  const add = (id: string) => {
    if (totalSelected >= N) return;
    setSelection((s) => [...s, id]);
  };
  const removeOne = (id: string) => {
    setSelection((s) => {
      const idx = s.lastIndexOf(id);
      if (idx < 0) return s;
      const next = s.slice();
      next.splice(idx, 1);
      return next;
    });
  };
  const clearItem = (id: string) => setSelection((s) => s.filter((x) => x !== id));

  // MRP total (used for strikethrough)
  const mrpTotal = selection.reduce((sum, id) => {
    const p = eligible.find((x) => x.id === id);
    if (!p) return sum;
    return sum + Number(p.price ?? 0);
  }, 0);

  const handleOrder = () => {
    if (!complete || !bundle || submitting) return;
    setSubmitting(true);
    const children: BundleChild[] = selection.map((id) => {
      const p = eligible.find((x) => x.id === id)!;
      return { productId: p.id, name: p.name, image: p.image_url ?? undefined, slug: p.slug ?? undefined };
    });
    // Signature of the picked children so two distinct combos of the SAME
    // bundle don't merge into one cart line (they'd otherwise share the
    // synthetic `bundle:<id>` productId + no variantId and collapse).
    const sig = [...children.map((c) => c.productId)].sort().join(",");
    let hash = 0;
    for (let i = 0; i < sig.length; i++) hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
    const variantId = `combo-${Math.abs(hash).toString(36)}`;
    addToCart({
      productId: `bundle:${bundle.id}`,
      variantId,
      name: bundle.name,
      price: Number(bundle.bundle_price),
      image: bundle.banner_url,
      quantity: 1,
      meta: {
        kind: "bundle",
        bundle_id: bundle.id,
        bundle_slug: bundle.slug,
        pick_count: N,
        children,
      },
    });
    toast.success(`${bundle.name} added to cart`);
    navigate(storefrontPath(store.slug, "cart"));
  };

  return (
    <div
      className="storefront-font min-h-[70vh]"
      style={{ backgroundColor: "var(--storefront-bg, transparent)", color: "var(--storefront-text, inherit)" }}
    >
      {/* Header */}
      <div className="mx-auto max-w-4xl px-4 pt-6 md:pt-10 pb-4">
        <h1
          className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
        >
          {bundle!.name}
        </h1>
        {bundle!.subheading && (
          <p className="mt-2 text-sm md:text-base text-muted-foreground">{bundle!.subheading}</p>
        )}
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-4xl px-3 pb-40">
        {prodLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-72 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : eligible.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-semibold">No eligible products right now</p>
            <p className="mt-1 text-xs text-muted-foreground">Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {eligible.map((p, i) => {
              const count = selectedCounts.get(p.id) ?? 0;
              const price = p.sale_price && p.sale_price < p.price ? p.sale_price : p.price;
              const discount = p.sale_price && p.sale_price < p.price ? Math.round(((p.price - p.sale_price) / p.price) * 100) : null;
              const tag = getTag(p, i);
              const canAdd = totalSelected < N;
              return (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl transition-shadow duration-300"
                  style={{
                    backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
                    border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)",
                  }}
                >
                  <div className="block p-1 pb-0">
                    <div
                      className="relative isolate w-full overflow-hidden rounded-xl"
                      style={{
                        aspectRatio: "3 / 4",
                        backgroundColor:
                          "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 3%, var(--storefront-bg, hsl(var(--background))))",
                      }}
                    >
                      {discount && (
                        <div className="absolute top-2 left-2 z-10">
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive px-1.5 py-0.5 text-[8px] font-bold text-destructive-foreground shadow-sm">
                            -{discount}%
                          </span>
                        </div>
                      )}
                      {tag && (
                        <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-full bg-black/85 px-2 py-0.5 text-[9px] font-semibold text-white">
                          <Zap className="h-2.5 w-2.5 text-amber-400" />
                          {tag}
                        </span>
                      )}
                      <img
                        src={p.image_url || "/placeholder.svg"}
                        alt={p.name}
                        width={400}
                        height={533}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover object-center"
                      />
                    </div>
                  </div>
                  <div className="px-3 pt-2 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1">
                    <div
                      className="flex items-start justify-between gap-2 border-b pb-1.5"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--storefront-text, hsl(var(--border))) 10%, transparent)",
                      }}
                    >
                      <h3
                        className="flex-1 text-[13px] font-semibold leading-tight line-clamp-1"
                        style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
                      >
                        {p.name}
                      </h3>
                      <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                        <Star className="h-3 w-3 fill-warning text-warning" />
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
                        >
                          {(4 + ((p.id?.charCodeAt(0) ?? 0) % 10) / 10).toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 min-w-0">
                      {p.sale_price && p.sale_price < p.price ? (
                        <>
                          <span
                            className="text-sm sm:text-base font-semibold whitespace-nowrap"
                            style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
                          >
                            {symbol}
                            {Number(price).toLocaleString("en-IN", { useGrouping: false })}
                          </span>
                          <span
                            className="text-[10px] sm:text-xs whitespace-nowrap line-through"
                            style={{
                              color:
                                "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)",
                            }}
                          >
                            {symbol}
                            {Number(p.price).toLocaleString("en-IN", { useGrouping: false })}
                          </span>
                          {discount && (
                            <span className="rounded-full bg-success px-1 py-0.5 text-[8px] font-bold text-success-foreground whitespace-nowrap shrink-0">
                              {discount}% off
                            </span>
                          )}
                        </>
                      ) : (
                        <span
                          className="text-sm sm:text-base font-semibold"
                          style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
                        >
                          {symbol}
                          {Number(price).toLocaleString("en-IN", { useGrouping: false })}
                        </span>
                      )}
                    </div>
                    {count === 0 ? (
                      <button
                        onClick={() => canAdd && add(p.id)}
                        disabled={!canAdd}
                        className="flex h-7 w-full items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider transition-transform active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                        style={{
                          backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                          color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                          borderRadius: "var(--storefront-button-radius, 0.375rem)",
                          fontFamily: "'Alegreya SC', serif",
                          fontWeight: 500,
                          letterSpacing: "0.06em",
                        }}
                      >
                        Select
                      </button>
                    ) : (
                      <div
                        className="flex h-7 w-full items-center overflow-hidden"
                        style={{
                          backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                          color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                          borderRadius: "var(--storefront-button-radius, 0.375rem)",
                        }}
                      >
                        <button
                          onClick={() => removeOne(p.id)}
                          className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-[0.96]"
                          aria-label="Decrease"
                        >
                          <Minus className="h-3 w-3" strokeWidth={2.5} />
                        </button>
                        <span
                          className="flex-1 text-center text-[10px] font-semibold whitespace-nowrap"
                          style={{ fontFamily: "'Alegreya SC', serif" }}
                        >
                          {count} selected
                        </span>
                        <button
                          onClick={() => canAdd && add(p.id)}
                          disabled={!canAdd}
                          className="flex h-full w-8 items-center justify-center transition-opacity hover:opacity-80 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Increase"
                        >
                          <Plus className="h-3 w-3" strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom bar — portaled to <body> so it escapes any ancestor
          transform / animation containing block and truly sticks to the
          viewport bottom on mobile (like the mobile nav). */}
      {typeof document !== "undefined" && createPortal(
      <div
        className="fixed inset-x-0 bottom-0 z-[60] border-t shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.15)]"
        style={{
          backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
          borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 py-3 md:px-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold whitespace-nowrap">{totalSelected}/{N} Selected</p>
              <div className="flex items-center gap-1 overflow-x-auto">
                {Array.from({ length: N }).map((_, i) => {
                  const id = selection[i];
                  const p = id ? eligible.find((x) => x.id === id) : undefined;
                  return (
                    <div key={i} className="relative shrink-0">
                      {p ? (
                        <>
                          <img
                            src={p.image_url || "/placeholder.svg"}
                            alt=""
                            className="h-10 w-10 rounded-md object-cover border"
                          />
                          <button
                            onClick={() => clearItem(p.id)}
                            className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-black text-white flex items-center justify-center"
                            aria-label="Remove"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </>
                      ) : (
                        <div className="h-10 w-10 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/50 text-xs">
                          +
                        </div>
                      )}
                      {i < N - 1 && <span className="mx-0.5 text-muted-foreground text-sm hidden sm:inline">+</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            {complete && mrpTotal > bundle!.bundle_price && (
              <p className="mt-1 text-[11px]">
                <span className="text-muted-foreground line-through">{symbol}{mrpTotal.toLocaleString("en-IN", { useGrouping: false })}</span>
                <span className="ml-1.5 font-bold">{symbol}{Number(bundle!.bundle_price).toLocaleString("en-IN", { useGrouping: false })}</span>
                <span className="ml-1 rounded bg-emerald-500 px-1 py-px text-[9px] font-bold text-white">
                  Save {Math.round(((mrpTotal - bundle!.bundle_price) / mrpTotal) * 100)}%
                </span>
              </p>
            )}
          </div>
          <button
            onClick={handleOrder}
            disabled={!complete || submitting}
            className="h-12 md:h-14 min-w-[130px] md:min-w-[180px] text-xs md:text-sm font-extrabold uppercase tracking-wide disabled:cursor-not-allowed transition-transform active:scale-[0.98] hover:brightness-110"
            style={
              complete && !submitting
                ? {
                    backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
                    color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
                    borderRadius: "var(--storefront-button-radius, 0.375rem)",
                    fontFamily: "'Alegreya SC', serif",
                    letterSpacing: "0.06em",
                  }
                : {
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                    borderRadius: "var(--storefront-button-radius, 0.375rem)",
                  }
            }
          >
            {submitting ? "Adding…" : complete ? "Order Combo" : `Add to Box${remaining > 0 ? ` (${remaining} more)` : ""}`}
          </button>
        </div>
      </div>,
      document.body
      )}
    </div>
  );
}