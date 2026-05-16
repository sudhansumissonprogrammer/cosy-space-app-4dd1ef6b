/**
 * /guides/:slug — individual guide page served by LandingApp.
 *
 * Per-route SEO via react-helmet-async with Article + BreadcrumbList JSON-LD.
 * Content body is trusted, in-repo HTML (src/content/guides.ts) so
 * dangerouslySetInnerHTML is safe here.
 */
import { Helmet } from "react-helmet-async";
import { useParams, Navigate, Link } from "react-router-dom";
import { getGuide, guides } from "@/content/guides";

const SITE_ORIGIN = "https://shopbanao.in";

export default function GuideDetail() {
  const { slug = "" } = useParams<{ slug: string }>();
  const guide = getGuide(slug);

  if (!guide) return <Navigate to="/guides" replace />;

  const canonical = `${SITE_ORIGIN}/guides/${guide.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.updatedAt,
    dateModified: guide.updatedAt,
    author: { "@type": "Organization", name: "ShopBanao" },
    publisher: {
      "@type": "Organization",
      name: "ShopBanao",
      logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/icon-512.png` },
    },
    mainEntityOfPage: canonical,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_ORIGIN}/guides` },
      { "@type": "ListItem", position: 3, name: guide.title, item: canonical },
    ],
  };

  const related = guides.filter((g) => g.slug !== guide.slug).slice(0, 2);

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>{`${guide.title} | ShopBanao`}</title>
        <meta name="description" content={guide.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={guide.title} />
        <meta property="og:description" content={guide.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={guide.updatedAt} />
        <meta property="article:modified_time" content={guide.updatedAt} />
        <script type="application/ld+json">{JSON.stringify(articleJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
      </Helmet>

      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="font-bold text-lg">ShopBanao</a>
          <a href="/signup" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Start free
          </a>
        </div>
      </header>

      <article className="container mx-auto px-4 py-12 max-w-3xl">
        <nav className="text-sm text-muted-foreground mb-6">
          <a href="/" className="hover:underline">Home</a>
          <span className="mx-2">›</span>
          <Link to="/guides" className="hover:underline">Guides</Link>
          <span className="mx-2">›</span>
          <span className="text-foreground">{guide.title}</span>
        </nav>

        <div className="text-xs font-medium text-primary mb-3">{guide.category}</div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
          {guide.title}
        </h1>
        <p className="text-lg text-muted-foreground mb-2">{guide.description}</p>
        <p className="text-xs text-muted-foreground mb-10">
          Updated {new Date(guide.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} · {guide.readingTime} min read
        </p>

        <div
          className="prose prose-neutral max-w-none [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-4 [&_p]:leading-relaxed [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_.lead]:text-lg [&_.lead]:text-muted-foreground [&_.lead]:mb-6 [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_table]:my-6 [&_th]:font-semibold"
          // Content is trusted, repo-authored — see src/content/guides.ts
          dangerouslySetInnerHTML={{ __html: guide.contentHtml }}
        />

        {related.length > 0 && (
          <section className="mt-16 border-t border-border pt-10">
            <h2 className="text-xl font-bold mb-4">Related guides</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {related.map((g) => (
                <Link
                  key={g.slug}
                  to={`/guides/${g.slug}`}
                  className="block rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
                >
                  <div className="text-xs font-medium text-primary mb-1">{g.category}</div>
                  <div className="font-semibold leading-snug">{g.title}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>

      <footer className="border-t border-border mt-16">
        <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground text-center">
          © {new Date().getFullYear()} ShopBanao. Built for Indian sellers.
        </div>
      </footer>
    </main>
  );
}
