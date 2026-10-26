import { useEffect } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { MapPin } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useStoreLocations } from "@/hooks/useStoreLocations";
import {
  directoryDescription,
  directoryH1,
  directoryTitle,
  locationTypeLabel,
} from "@/lib/storeLocations";
import { getStoreBaseUrl } from "@/lib/storeUrl";

const DIRECTORY_LD_ID = "json-ld-store-directory";

/**
 * /stores — store directory. Lists every published city/location page.
 * Stores without published locations get a noindex "not found" state so the
 * route never soft-indexes as a thin empty page.
 */
export default function StorefrontStoresDirectory() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const storeSlug = slug || store.slug;
  const { data: locations, isLoading } = useStoreLocations(store.id);
  const hasLocations = (locations?.length ?? 0) > 0;

  const title = directoryTitle(store);
  const description = directoryDescription(store, locations || []);

  useMetaTags({
    title,
    description,
    ogImage: store.logo_url || undefined,
    storeSlug: store.slug,
    customDomain: store.custom_domain,
    canonicalPath: "stores",
    noIndex: !isLoading && !hasLocations,
  });

  // BreadcrumbList + ItemList of city pages (summary markup only).
  useEffect(() => {
    if (!hasLocations) return;
    const base = getStoreBaseUrl(store.slug, store.custom_domain);
    const breadcrumb = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: store.name, item: base },
        { "@type": "ListItem", position: 2, name: "Stores", item: `${base}/stores` },
      ],
    };
    const itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${store.name} store & delivery locations`,
      numberOfItems: locations!.length,
      itemListElement: locations!.map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${base}/stores/${l.slug}`,
        name: l.city,
      })),
    };
    let el = document.getElementById(DIRECTORY_LD_ID) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = DIRECTORY_LD_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify([breadcrumb, itemList]);
    return () => {
      document.getElementById(DIRECTORY_LD_ID)?.remove();
    };
  }, [hasLocations, locations, store.slug, store.custom_domain, store.name]);

  if (!isLoading && !hasLocations) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Store locations</h1>
        <p className="mt-2 text-muted-foreground">This store has not published any locations yet.</p>
        <Link to={storefrontPath(storeSlug, "")} className="mt-4 inline-block text-sm font-medium text-primary underline">
          Back to {store.name}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 sm:px-4 lg:px-6 py-6">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to={storefrontPath(storeSlug, "")} className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Stores</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-bold text-foreground">{directoryH1(store)}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground max-w-2xl">{description}</p>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {(locations || []).map((loc) => (
          <Link
            key={loc.slug}
            to={storefrontPath(storeSlug, `stores/${loc.slug}`)}
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
          >
            <MapPin className="h-5 w-5 text-primary mb-2" />
            <div className="font-semibold text-foreground">{loc.city}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{locationTypeLabel(loc.location_type)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
