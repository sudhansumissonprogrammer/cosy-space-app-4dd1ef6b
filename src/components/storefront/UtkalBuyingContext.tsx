import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { UTKAL_STATUS, UTKAL_QUALITY_TERMS } from "../../../supabase/functions/_shared/utkalContent";

/** Visible buying context, shared by the Utkal home and about page. */
export default function UtkalBuyingContext({ slug, description }: { slug: string; description?: string | null }) {
  return (
    <section className="space-y-3 text-sm leading-relaxed text-foreground" aria-label="About the watches">
      {description?.trim() && <p>{description}</p>}
      <h2 className="text-base font-semibold">Before choosing a watch</h2>
      <p>{UTKAL_STATUS}</p>
      <p className="text-muted-foreground">{UTKAL_QUALITY_TERMS}</p>
      <nav aria-label="Watch collections and buying information" className="flex flex-wrap gap-x-5 gap-y-2">
        {[
          ["shop", "All watches"],
          ["category/men-s-watch", "Men's collection"],
          ["category/women-s-watch", "Women's collection"],
          ["shipping-policy", "Shipping policy"],
          ["return-policy", "Returns policy"],
          ["contact", "Contact"],
        ].map(([path, label]) => <Link key={path} to={storefrontPath(slug, path)} className="underline underline-offset-4">{label}</Link>)}
      </nav>
    </section>
  );
}