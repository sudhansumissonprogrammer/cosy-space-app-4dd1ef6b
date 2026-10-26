import { useEffect, useMemo, useRef } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, MessageCircle, Navigation, Truck } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";
import { useMetaTags } from "@/hooks/useMetaTags";
import { useStoreLocations } from "@/hooks/useStoreLocations";
import { useInfiniteProducts } from "@/hooks/useInfiniteProducts";
import UniversalProductCard from "@/components/storefront/UniversalProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { waPhoneNumber } from "@/lib/phoneUtils";
import {
  cityFaqItems,
  cityIntroParagraph,
  cityPageDescription,
  cityPageH1,
  cityPageTitle,
  formatOpeningHours,
  locationTypeLabel,
  mapsSearchUrl,
} from "@/lib/storeLocations";
import { getStoreBaseUrl } from "@/lib/storeUrl";

const CITY_LD_ID = "json-ld-city-page";
const CITY_PRODUCTS_SHOWN = 12;

/**
 * /stores/:citySlug — city shopping page.
 * Content is built only from the published store_locations record and the
 * store record: no invented addresses, hours, stock or services. A city with
 * no published record renders a noindex not-found state.
 */
export default function StorefrontCityPage() {
  const store = useOutletContext<StoreData>();
  const { slug, citySlug } = useParams<{ slug: string; citySlug: string }>();
  const storeSlug = slug || store.slug;
  const { data: locations, isLoading } = useStoreLocations(store.id);
  const location = useMemo(
    () => (locations || []).find((l) => l.slug === citySlug) || null,
    [locations, citySlug],
  );
  const mainStore = useMemo(
    () => (locations || []).find((l) => l.location_type === "main_store") || null,
    [locations],
  );

  const { data: productsData, isLoading: productsLoading } = useInfiniteProducts({
    storeId: store.id,
    queryKeyPrefix: "city-products",
    ready: !!location,
  });
  const products = (productsData?.pages.flatMap((p) => p.products) || []).slice(0, CITY_PRODUCTS_SHOWN);

  const notFound = !isLoading && !location;
  const title = location ? cityPageTitle(store, location.city) : "Location not found";
  const description = location ? cityPageDescription(store, location) : "";

  useMetaTags({
    title,
    description,
    ogImage: store.logo_url || undefined,
    storeSlug: store.slug,
    customDomain: store.custom_domain,
    canonicalPath: location ? `stores/${location.slug}` : undefined,
    noIndex: notFound,
  });

  // BreadcrumbList always; Store markup only when a verified address exists.
  useEffect(() => {
    if (!location) return;
    const base = getStoreBaseUrl(store.slug, store.custom_domain);
    const pageUrl = `${base}/stores/${location.slug}`;
    const graphs: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: store.name, item: base },
          { "@type": "ListItem", position: 2, name: "Stores", item: `${base}/stores` },
          { "@type": "ListItem", position: 3, name: location.city, item: pageUrl },
        ],
      },
    ];
    if (location.address_line) {
      const hours = formatOpeningHours(location.opening_hours);
      graphs.push({
        "@context": "https://schema.org",
        "@type": "Store",
        "@id": `${pageUrl}#store`,
        name: location.store_name || `${store.name} — ${location.city}`,
        url: pageUrl,
        address: {
          "@type": "PostalAddress",
          streetAddress: location.address_line,
          addressLocality: location.city,
          addressCountry: "IN",
          ...(location.pincode ? { postalCode: location.pincode } : {}),
        },
        ...(location.phone || location.whatsapp
          ? { telephone: location.phone || location.whatsapp }
          : {}),
        ...(hours ? { openingHours: hours.replace(/^Open daily, /, "Mo-Su ") } : {}),
        ...(location.latitude != null && location.longitude != null
          ? { geo: { "@type": "GeoCoordinates", latitude: location.latitude, longitude: location.longitude } }
          : {}),
      });
    }
    let el = document.getElementById(CITY_LD_ID) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = CITY_LD_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(graphs);
    return () => {
      document.getElementById(CITY_LD_ID)?.remove();
    };
  }, [location, store.slug, store.custom_domain, store.name]);

  const signalled = useRef(false);
  useEffect(() => {
    if (!signalled.current && !isLoading) {
      signalled.current = true;
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("storefront:content-ready"));
      });
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-full" style={{ aspectRatio: "4/5" }} />
          ))}
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Location not found</h1>
        <p className="mt-2 text-muted-foreground">We don't have a page for this city yet.</p>
        <Link to={storefrontPath(storeSlug, "stores")} className="mt-4 inline-block text-sm font-medium text-primary underline">
          View all stores &amp; delivery cities
        </Link>
      </div>
    );
  }

  const hours = formatOpeningHours(location.opening_hours);
  const isPhysical = location.location_type !== "delivery_only" && !!location.address_line;
  const whatsapp = location.whatsapp || store.whatsapp_number;
  const waNumber = whatsapp ? waPhoneNumber(whatsapp) : null;
  const faq = cityFaqItems(store, location, mainStore);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6 py-5">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link to={storefrontPath(storeSlug, "")} className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link to={storefrontPath(storeSlug, "stores")} className="hover:text-foreground transition-colors">Stores</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{location.city}</span>
      </nav>

      <div className="mb-4 flex items-center gap-3">
        <Link
          to={storefrontPath(storeSlug, "stores")}
          aria-label="Back to all stores"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{cityPageH1(store, location.city)}</h1>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {cityIntroParagraph(store, location)}
      </p>

      {/* Store / delivery information */}
      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            {isPhysical ? `${locationTypeLabel(location.location_type)} in ${location.city}` : `Delivery to ${location.city}`}
          </h2>
          <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {isPhysical ? (
              <>
                <p>{location.address_line}{location.pincode ? ` — ${location.pincode}` : ""}</p>
                {hours && <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{hours}</p>}
                <a
                  href={location.map_url || mapsSearchUrl(location.address_line!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <Navigation className="h-3.5 w-3.5" /> Get directions
                </a>
              </>
            ) : (
              <>
                <p>
                  {store.name} does not have a physical branch in {location.city} yet. Order online and
                  {mainStore ? ` your watch is dispatched from our main store in ${mainStore.city}.` : " your order is dispatched from our main store."}
                </p>
                {location.delivery_notes && <p>{location.delivery_notes}</p>}
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Truck className="h-4 w-4 text-primary" /> Ordering &amp; delivery
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Browse the catalogue and order online — cash on delivery is available.</li>
            {mainStore && <li>Orders are packed and dispatched from {mainStore.city}{store.state ? `, ${store.state}` : ""}.</li>}
            <li>
              See the{" "}
              <Link to={storefrontPath(storeSlug, "shipping-policy")} className="font-medium text-primary hover:underline">
                shipping policy
              </Link>{" "}
              for delivery timing and charges.
            </li>
            {waNumber && (
              <li>
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Ask about availability on WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* Products — links go to the existing canonical product pages */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Shop watches delivered to {location.city}</h2>
          <Link to={storefrontPath(storeSlug, "shop")} className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {productsLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-full" style={{ aspectRatio: "4/5" }} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, index) => (
              <UniversalProductCard
                key={product.id}
                product={product}
                slug={storeSlug}
                store={store}
                priority={index < 4}
                index={index}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Products are being added — check the full catalogue soon.</p>
        )}
      </section>

      {/* Practical questions — verified answers only */}
      {faq.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Common questions</h2>
          <div className="space-y-2">
            {faq.map((item) => (
              <details key={item.q} className="rounded-xl border border-border bg-card px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-foreground">{item.q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Related navigation */}
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Related pages">
        <Link to={storefrontPath(storeSlug, "stores")} className="rounded-full border border-border bg-card px-3 py-1.5 hover:bg-accent transition-colors">
          All stores &amp; cities
        </Link>
        <Link to={storefrontPath(storeSlug, "categories")} className="rounded-full border border-border bg-card px-3 py-1.5 hover:bg-accent transition-colors">
          Browse categories
        </Link>
        <Link to={storefrontPath(storeSlug, "shop")} className="rounded-full border border-border bg-card px-3 py-1.5 hover:bg-accent transition-colors">
          Shop all
        </Link>
        <Link to={storefrontPath(storeSlug, "contact")} className="rounded-full border border-border bg-card px-3 py-1.5 hover:bg-accent transition-colors">
          Contact us
        </Link>
      </nav>
    </div>
  );
}
