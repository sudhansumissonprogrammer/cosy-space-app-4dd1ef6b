import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { storefrontPath } from "@/lib/subdomain";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import type { BundleDef, BundleChild } from "@/lib/appStore/bundle/types";
import { bundleTypeOf } from "@/lib/appStore/bundle/types";
import { previewBundleTotals } from "@/lib/appStore/bundle/pricingEngine";

type StoreData = Tables<"stores">;

interface Row {
  id: string;
  slug: string | null;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  stock_quantity: number | null;
  is_active?: boolean;
}

interface Props {
  store: StoreData;
  bundle: BundleDef;
}

/**
 * Renderer for `fixed` and `fbt` bundle types on /bundles/:slug.
 * - fixed: shows the exact combo (all children checked, uncheck disabled).
 * - fbt: anchors are pre-checked, companions checkable; at least 2 must be picked.
 *
 * Same cart contract as pick_n (meta.kind === "bundle" + children[]).
 * place-order re-derives price server-side so no client tampering is possible.
 */
export default function FixedBundleCard({ store, bundle }: Props) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const type = bundleTypeOf(bundle);
  const [submitting, setSubmitting] = useState(false);

  // Ids we need to fetch depend on type.
  const productIds = useMemo<string[]>(() => {
    if (type === "fixed") return [...(bundle.fixed_children ?? [])];
    if (type === "fbt")
      return [
        ...(bundle.fbt_anchor_product_ids ?? []),
        ...(bundle.fbt_companion_product_ids ?? []),
      ];
    return [];
  }, [bundle, type]);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["bundle-fixed-fbt", store.id, bundle.id, productIds.join(",")],
    enabled: !!store.id && productIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id,slug,name,price,sale_price,image_url,stock_quantity,is_active")
        .in("id", productIds);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Preserve merchant ordering (matches config order) so shoppers see the intended sequence.
  const ordered = useMemo<Row[]>(() => {
    const map = new Map((rows ?? []).map((r) => [r.id, r]));
    return productIds
      .map((id) => map.get(id))
      .filter((r): r is Row => !!r && r.is_active !== false);
  }, [rows, productIds]);

  // FBT: track which items are checked. Anchors default true; companions default true too
  // (Amazon-style pre-checked "add all" flow — shopper unchecks anything they don't want).
  const anchors = new Set(bundle.fbt_anchor_product_ids ?? []);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init: Record<string, boolean> = {};
    for (const r of ordered) init[r.id] = true;
    setChecked(init);
  }, [ordered.map((r) => r.id).join(",")]);

  const currency = (store.currency as string) || "INR";
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;

  const activeChildren = useMemo(() => {
    if (type === "fixed") return ordered;
    return ordered.filter((r) => checked[r.id]);
  }, [ordered, checked, type]);

  const childRefs = activeChildren.map((r) => ({
    productId: r.id,
    pricePaise: Math.round(Number(r.sale_price ?? r.price) * 100),
  }));

  const { total, mrp, savings, pctOff } = previewBundleTotals(bundle, childRefs);

  // Validation
  const stockOk = activeChildren.every((r) => (r.stock_quantity ?? 1) > 0);
  const minMet = type === "fixed" ? activeChildren.length === ordered.length : activeChildren.length >= 2;
  const canOrder = stockOk && minMet && activeChildren.length > 0 && total > 0;

  const handleAdd = () => {
    if (!canOrder || submitting) return;
    setSubmitting(true);
    const children: BundleChild[] = activeChildren.map((r) => ({
      productId: r.id,
      name: r.name,
      image: r.image_url ?? undefined,
      slug: r.slug ?? undefined,
    }));
    // Same deterministic combo-hash used by pick_n so distinct picks stay
    // separate on cart. (BOGO/mix_match will hash variantId too when added.)
    const sig = children.map((c) => c.productId).sort().join(",");
    let hash = 0;
    for (let i = 0; i < sig.length; i++) hash = ((hash << 5) - hash + sig.charCodeAt(i)) | 0;
    const variantId = `combo-${Math.abs(hash).toString(36)}`;
    addToCart({
      productId: `bundle:${bundle.id}`,
      variantId,
      name: bundle.name,
      price: total, // preview total; place-order re-derives from DB
      image: bundle.banner_url,
      quantity: 1,
      meta: {
        kind: "bundle",
        bundle_id: bundle.id,
        bundle_slug: bundle.slug,
        pick_count: children.length,
        bundle_type: type,
        children,
      },
    });
    toast.success(`${bundle.name} added to cart`);
    navigate(storefrontPath(store.slug, "cart"));
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="h-8 w-56 bg-muted rounded animate-pulse mb-6" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (ordered.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">This combo is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">Its products may have been removed.</p>
      </div>
    );
  }

  return (
    <div
      className="storefront-font min-h-[70vh]"
      style={{ backgroundColor: "var(--storefront-bg, transparent)", color: "var(--storefront-text, inherit)" }}
    >
      <div className="mx-auto max-w-3xl px-4 pt-6 md:pt-10 pb-32">
        <h1
          className="text-3xl md:text-4xl font-bold tracking-tight text-center"
          style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
        >
          {bundle.name}
        </h1>
        {bundle.subheading && (
          <p className="mt-2 text-center text-sm md:text-base text-muted-foreground">{bundle.subheading}</p>
        )}

        {bundle.banner_url && (
          <img
            src={bundle.banner_url}
            alt={bundle.name}
            className="mt-6 w-full h-48 md:h-64 object-cover rounded-xl"
            loading="lazy"
          />
        )}

        <div className="mt-6 space-y-2">
          {ordered.map((r) => {
            const isChecked = !!checked[r.id];
            const isAnchor = anchors.has(r.id);
            const outOfStock = (r.stock_quantity ?? 1) <= 0;
            const price = Number(r.sale_price ?? r.price);
            const disabled = type === "fixed" || outOfStock;
            return (
              <label
                key={r.id}
                className={`flex items-center gap-3 rounded-xl border p-2.5 md:p-3 cursor-pointer transition-colors ${
                  isChecked ? "border-primary/50 bg-primary/[0.03]" : "border-input bg-background"
                } ${disabled && type !== "fixed" ? "opacity-50" : ""}`}
              >
                {type === "fbt" && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(e) => setChecked((c) => ({ ...c, [r.id]: e.target.checked }))}
                    className="h-5 w-5 accent-current"
                  />
                )}
                <img
                  src={r.image_url || "/placeholder.svg"}
                  alt={r.name}
                  className="h-14 w-14 md:h-16 md:w-16 rounded-md object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{r.name}</p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">{symbol}{price.toLocaleString("en-IN", { useGrouping: false })}</span>
                    {isAnchor && (
                      <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        This item
                      </span>
                    )}
                    {outOfStock && (
                      <span className="rounded bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        Out of stock
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Sticky combo summary — portaled to <body> so ancestor animations
          (PageTransition) don't turn it into an in-flow element. */}
      {typeof document !== "undefined" && createPortal(
      <div
        className="fixed inset-x-0 bottom-0 z-[60] border-t shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.15)]"
        style={{
          backgroundColor: "var(--storefront-bg, hsl(var(--background)))",
          borderColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-3 md:px-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {activeChildren.length} item{activeChildren.length === 1 ? "" : "s"} · Total
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg font-bold">{symbol}{total.toLocaleString("en-IN", { useGrouping: false })}</span>
              {savings > 0 && (
                <>
                  <span className="text-xs text-muted-foreground line-through">{symbol}{mrp.toLocaleString("en-IN", { useGrouping: false })}</span>
                  <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Save {symbol}{savings.toLocaleString("en-IN", { useGrouping: false })} ({pctOff}%)
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!canOrder || submitting}
            className="h-12 md:h-14 min-w-[130px] md:min-w-[180px] text-xs md:text-sm font-extrabold uppercase tracking-wide disabled:cursor-not-allowed transition-transform active:scale-[0.98] hover:brightness-110"
            style={
              canOrder && !submitting
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
            {submitting ? "Adding…" : !minMet ? "Pick 2+ items" : !stockOk ? "Out of stock" : "Add Combo"}
          </button>
        </div>
      </div>,
      document.body
      )}
    </div>
  );
}