import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  image_url: string | null;
}

export function useCustomPages(storeId: string | undefined) {
  return useQuery({
    queryKey: ["storefront-custom-pages", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pages")
        .select("id, title, slug, content, image_url")
        .eq("store_id", storeId!)
        .eq("page_type", "custom")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CustomPage[];
    },
    enabled: !!storeId,
    staleTime: 5 * 60 * 1000,
  });
}
