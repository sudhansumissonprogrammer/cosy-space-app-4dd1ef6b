import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import { LayoutGrid } from "lucide-react";

interface Props { storeId: string; slug: string; }

/** Horizontal quick-jump pill row. Uses cached `categories-shop` query. */
export default function CategoryQuickJump({ storeId, slug }: Props) {
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

  return (
    <div className="-mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 mb-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <Link
          to={storefrontPath(slug, "categories")}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-foreground text-background text-[12px] font-semibold"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          All
        </Link>
        {cats.map((c: any) => (
          <Link
            key={c.id}
            to={storefrontPath(slug, `category/${c.slug}`)}
            className="shrink-0 inline-flex items-center gap-2 pl-1 pr-3 h-8 rounded-full bg-card border border-border text-[12px] font-semibold text-foreground hover:bg-accent transition-colors"
          >
            {c.image_url ? (
              <img src={c.image_url} alt="" className="h-6 w-6 rounded-full object-cover" loading="lazy" />
            ) : (
              <span className="h-6 w-6 rounded-full bg-accent" />
            )}
            <span className="truncate max-w-[110px]">{c.name}</span>
          </Link>
        ))}
      </div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  );
}
