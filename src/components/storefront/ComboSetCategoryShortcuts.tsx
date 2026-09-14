import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { storefrontPath } from "@/lib/subdomain";
import { Skeleton } from "@/components/ui/skeleton";

type ShortcutProduct = {
  id: string;
  image_url: string | null;
};

type ShortcutGroup = {
  label: string;
  action: string;
  categoryName: string;
  categorySlug: string;
};

const GROUPS: ShortcutGroup[] = [
  { label: "Chains", action: "Shop Chains", categoryName: "chain", categorySlug: "chain" },
  { label: "Rings", action: "Shop Rings", categoryName: "Ring-1", categorySlug: "ring-1" },
];

interface ComboSetCategoryShortcutsProps {
  storeId: string;
  storeSlug: string;
  onReady: () => void;
}

async function preloadImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          const settle = () => resolve();
          image.onload = settle;
          image.onerror = settle;
          image.src = url;
        }),
    ),
  );
}

export default function ComboSetCategoryShortcuts({
  storeId,
  storeSlug,
  onReady,
}: ComboSetCategoryShortcutsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["combo-set-mobile-shortcuts", storeId],
    queryFn: async () => {
      const rows = await Promise.all(
        GROUPS.map(async (group) => {
          const { data: products, error } = await supabase
            .from("products")
            .select("id,image_url")
            .eq("store_id", storeId)
            .eq("is_active", true)
            .eq("category", group.categoryName)
            .not("image_url", "is", null)
            .order("display_order", { ascending: true })
            .limit(4);
          if (error) throw error;
          return [group.categorySlug, (products || []) as ShortcutProduct[]] as const;
        }),
      );
      return Object.fromEntries(rows) as Record<string, ShortcutProduct[]>;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const imageUrls = useMemo(
    () =>
      GROUPS.flatMap((group) => data?.[group.categorySlug] || [])
        .map((product) => optimizeImageUrl(product.image_url, 180, 80))
        .filter(Boolean),
    [data],
  );

  useEffect(() => {
    if (isLoading) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) onReady();
    }, 2500);
    void preloadImages(imageUrls).finally(() => {
      window.clearTimeout(timeout);
      if (active) onReady();
    });
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [imageUrls, isLoading, onReady]);

  return (
    <section className="grid grid-cols-2 gap-2 pb-1 md:hidden" aria-label="Shop related jewellery">
      {GROUPS.map((group) => {
        const products = data?.[group.categorySlug] || [];
        return (
          <Link
            key={group.categorySlug}
            to={storefrontPath(storeSlug, `category/${group.categorySlug}`)}
            className="overflow-hidden rounded-lg border border-border bg-card transition-colors active:bg-accent"
            aria-label={group.action}
          >
            <div className="grid aspect-[2/1] grid-cols-4 gap-px overflow-hidden bg-muted">
              {Array.from({ length: 4 }).map((_, index) => {
                const product = products[index];
                return product?.image_url ? (
                  <img
                    key={product.id}
                    src={optimizeImageUrl(product.image_url, 180, 80)}
                    alt=""
                    width={90}
                    height={90}
                    loading="eager"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Skeleton key={index} className="h-full w-full rounded-none" />
                );
              })}
            </div>
            <div className="flex h-9 items-center justify-between gap-1 px-2.5">
              <span className="min-w-0 truncate text-xs font-semibold text-foreground">{group.action}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </div>
          </Link>
        );
      })}
    </section>
  );
}