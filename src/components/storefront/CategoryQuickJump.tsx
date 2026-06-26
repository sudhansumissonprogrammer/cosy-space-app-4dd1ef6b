import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import { LayoutGrid } from "lucide-react";

interface Props { storeId: string; slug: string; activeCategory?: string }

/** Horizontal quick-jump pill row. Uses cached `categories-shop` query. */
export default function CategoryQuickJump({ storeId, slug, activeCategory }: Props) {
  const { data: cats = [] } = useQuery({
    queryKey: ["categories-shop", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("categories")
        .select("id, name, slug, image_url")
        .eq("store_id", storeId)
        .order("display_order", { ascending: true })
        .limit(20);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!cats.length) return null;

  const isAllActive = !activeCategory;

  return (
    <div className="-mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 mb-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <Link
          to={storefrontPath(slug, "shop")}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${
            isAllActive
              ? "bg-foreground text-background"
              : "bg-card border border-border text-foreground hover:bg-accent"
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          All
        </Link>
        {cats.map((c: any) => {
          const active = activeCategory === c.slug;
          return (
            <Link
              key={c.id}
              to={storefrontPath(slug, `shop?category=${c.slug}`)}
              className={`shrink-0 inline-flex items-center gap-2 pl-1 pr-3 h-8 rounded-full text-[12px] font-semibold transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-foreground hover:bg-accent"
              }`}
            >
              {c.image_url ? (
                <img src={c.image_url} alt="" className="h-6 w-6 rounded-full object-cover" loading="lazy" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-accent" />
              )}
              <span className="truncate max-w-[110px] capitalize">{c.name}</span>
            </Link>
          );
        })}
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  );
}
