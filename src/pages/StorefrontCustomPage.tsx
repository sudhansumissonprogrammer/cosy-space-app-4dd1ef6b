import { useOutletContext, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import CustomHtmlRenderer from "@/components/storefront/CustomHtmlRenderer";
import { useMetaTags } from "@/hooks/useMetaTags";
import type { StoreData } from "@/layouts/StorefrontLayout";

export default function StorefrontCustomPage() {
  const store = useOutletContext<StoreData>();
  const { pageSlug, slug } = useParams<{ pageSlug: string; slug?: string }>();

  // Resolve store id from slug or subdomain
  const storeSlug = store.slug || slug;

  const { data: page, isLoading } = useQuery({
    queryKey: ["storefront-custom-page", storeSlug, pageSlug],
    queryFn: async () => {
      if (!pageSlug || !storeSlug) return null;
      const { data, error } = await (supabase as any).rpc("get_store_custom_page", {
        _store_slug: storeSlug,
        _page_slug: pageSlug,
      });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] ?? null : data ?? null;
      return row;
    },
    enabled: !!pageSlug && !!storeSlug,
  });

  useMetaTags({
    enabled: !!page,
    title: page ? `${page.title} — ${store.name}` : undefined,
    storeSlug: store.slug,
    customDomain: store.custom_domain,
    canonicalPath: pageSlug ? `page/${pageSlug}` : undefined,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
          Page Not Found
        </h1>
        <p className="mt-2 text-muted-foreground">The page you're looking for doesn't exist.</p>
      </div>
    );
  }

  // Render custom HTML if available
  const customHtml = (page as any).custom_html as string | null;
  if (customHtml?.trim()) {
    return <CustomHtmlRenderer html={customHtml} className="" />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1
        className="text-2xl md:text-3xl font-bold mb-6"
        style={{
          color: "var(--storefront-text, hsl(var(--foreground)))",
          fontFamily: "var(--storefront-heading-font, inherit)",
        }}
      >
        {page.title}
      </h1>

      {page.image_url && (
        <img
          src={page.image_url}
          alt={page.title}
          className="w-full max-h-[400px] object-cover rounded-xl mb-6"
        />
      )}

      {page.content && (
        <div
          className="prose prose-sm max-w-none whitespace-pre-line"
          style={{
            color: "var(--storefront-text, hsl(var(--foreground)))",
            fontFamily: "var(--storefront-body-font, inherit)",
          }}
        >
          {page.content}
        </div>
      )}
    </div>
  );
}
