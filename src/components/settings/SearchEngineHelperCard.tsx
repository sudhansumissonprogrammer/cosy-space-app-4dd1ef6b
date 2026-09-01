import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Search, Award } from "lucide-react";

/* ── Phase 2: Search Engine Helpers (sitemap/robots URLs, GSC + GBP CTAs) ── */
export default function SearchEngineHelperCard({
  slug,
  storeName,
  customDomain,
  whatsappNumber,
  city,
}: {
  slug: string;
  storeName: string;
  customDomain: string | null;
  whatsappNumber: string;
  city: string;
}) {
  const primaryHost = customDomain || `${slug}.shopbanao.in`;
  const primaryBase = `https://${primaryHost}`;
  const sitemapUrl = `${primaryBase}/sitemap.xml`;
  const robotsUrl = `${primaryBase}/robots.txt`;
  const llmsUrl = `${primaryBase}/llms.txt`;

  const copy = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} URL copied`);
    } catch {
      toast.error("Copy failed — long-press the link to copy manually");
    }
  };

  // Google Business Profile prefill — these are standard create-flow params.
  const gbpParams = new URLSearchParams();
  if (storeName) gbpParams.set("name", storeName);
  gbpParams.set("website", primaryBase);
  if (whatsappNumber) gbpParams.set("phone", whatsappNumber);
  if (city) gbpParams.set("city", city);
  const gbpUrl = `https://business.google.com/create?${gbpParams.toString()}`;

  // GSC links
  const gscAddProperty = `https://search.google.com/search-console/welcome?utm_source=shopbanao`;
  const gscSubmitSitemap = `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(primaryBase + "/")}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" /> Search Engine Submission
        </CardTitle>
        <CardDescription>
          Submit your store to Google so it shows up when customers search your brand name.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Sitemap / Robots / llms URLs */}
        <div className="space-y-3">
          {[
            { label: "Sitemap", url: sitemapUrl, hint: "Lists every page Google should index" },
            { label: "Robots", url: robotsUrl, hint: "Tells crawlers what they may visit" },
            { label: "llms.txt", url: llmsUrl, hint: "Helps AI assistants describe your store" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-primary hover:underline"
                  >
                    {item.url}
                  </a>
                  <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy(item.url, item.label)}
                >
                  Copy
                </Button>
              </div>
            </div>
          ))}
          {customDomain && (
            <p className="text-xs text-muted-foreground">
              Your subdomain copies of these files automatically redirect to your custom
              domain, so Google sees one canonical version of your store.
            </p>
          )}
        </div>

        {/* Google Search Console */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">1. Google Search Console</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verify ownership and submit your sitemap so Google starts crawling your store.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="default" asChild>
              <a href={gscAddProperty} target="_blank" rel="noopener noreferrer">
                Add property
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={gscSubmitSitemap} target="_blank" rel="noopener noreferrer">
                Submit sitemap
              </a>
            </Button>
          </div>
        </div>

        {/* Google Business Profile */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">2. Google Business Profile</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A claimed Business Profile is the biggest single driver of brand-name search ranking
            in India. It also unlocks the right-side info panel with your logo and photos.
          </p>
          <div className="mt-3">
            <Button type="button" size="sm" variant="default" asChild>
              <a href={gbpUrl} target="_blank" rel="noopener noreferrer">
                <Award className="mr-2 h-4 w-4" /> Claim Business Profile
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
