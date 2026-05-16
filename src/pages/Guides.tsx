/**
 * /guides — index of marketing guides served by LandingApp.
 *
 * Kept lightweight: no Supabase, no React Query, no theme code paths.
 * Per-route SEO via react-helmet-async; Article/BreadcrumbList JSON-LD
 * lives in GuideDetail.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { guides } from "@/content/guides";

const SITE_ORIGIN = "https://shopbanao.in";

export default function Guides() {
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "ShopBanao guides",
    numberOfItems: guides.length,
    itemListElement: guides.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_ORIGIN}/guides/${g.slug}`,
      name: g.title,
    })),
  };

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>Guides — WhatsApp store, online store builder India | ShopBanao</title>
        <meta
          name="description"
          content="Practical guides for Indian D2C sellers: how to build a WhatsApp store, compare online store builders, and pick the best Shopify alternative."
        />
        <link rel="canonical" href={`${SITE_ORIGIN}/guides`} />
        <meta property="og:title" content="Guides for Indian online sellers — ShopBanao" />
        <meta
          property="og:description"
          content="Practical, India-first guides on WhatsApp ordering, payments, and storefront SEO."
        />
        <meta property="og:url" content={`${SITE_ORIGIN}/guides`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
      </Helmet>

      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="font-bold text-lg">ShopBanao</a>
          <a href="/signup" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Start free
          </a>
        </div>
      </header>

      <section className="container mx-auto px-4 py-12 max-w-4xl">
        <nav className="text-sm text-muted-foreground mb-4">
          <a href="/" className="hover:underline">Home</a>
          <span className="mx-2">›</span>
          <span>Guides</span>
        </nav>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Guides</h1>
        <p className="text-lg text-muted-foreground mb-10 max-w-2xl">
          India-first playbooks on WhatsApp ordering, online store builders, payments, and SEO — written for D2C founders.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          {guides.map((g) => (
            <Link
              key={g.slug}
              to={`/guides/${g.slug}`}
              className="block rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-colors"
            >
              <div className="text-xs font-medium text-primary mb-2">{g.category}</div>
              <h2 className="text-xl font-semibold mb-2 leading-snug">{g.title}</h2>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{g.description}</p>
              <div className="text-xs text-muted-foreground">{g.readingTime} min read</div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} ShopBanao. Built for Indian sellers.
        </div>
      </footer>
    </main>
  );
}
