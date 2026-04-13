import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";

interface SectionHeadingProps {
  title: string;
  slug?: string;
  linkTo?: string;
  className?: string;
}

/**
 * Premium section heading with elegant line divider.
 * Desktop shows a clean "View All →" aligned right like Ochaka.
 */
export default function SectionHeading({ title, slug, linkTo, className = "" }: SectionHeadingProps) {
  return (
    <div className={`flex flex-col items-center mb-4 lg:mb-6 ${className}`}>
      <div className="flex items-center justify-between w-full">
        <div className="flex-1" />
        <h2
          className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold tracking-wide whitespace-nowrap text-center"
          style={{
            fontFamily: "var(--storefront-heading-font, 'Alegreya SC', serif)",
            color: "var(--storefront-text, hsl(var(--foreground)))",
          }}
        >
          {title}
        </h2>
        <div className="flex-1 flex justify-end">
          {slug && linkTo && (
            <Link
              to={storefrontPath(slug, linkTo)}
              className="text-sm font-semibold flex items-center gap-1 transition-all hover:gap-2 group"
              style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
            >
              <span className="hidden sm:inline">View All</span>
              <span className="sm:hidden">All</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>
      {/* Elegant line divider with diamond accent */}
      <div className="flex items-center gap-2 mt-1.5 w-full max-w-[160px] sm:max-w-[200px]" aria-hidden="true">
        <div className="flex-1 h-[1px]" style={{ background: `linear-gradient(to right, transparent, var(--storefront-primary, hsl(var(--primary))))` }} />
        <div
          className="w-1.5 h-1.5 rotate-45 shrink-0"
          style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}
        />
        <div className="flex-1 h-[1px]" style={{ background: `linear-gradient(to left, transparent, var(--storefront-primary, hsl(var(--primary))))` }} />
      </div>
    </div>
  );
}
