import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { storefrontPath } from "@/lib/subdomain";

interface SectionHeadingProps {
  title: string;
  slug?: string;
  linkTo?: string;
  className?: string;
}

/**
 * Premium section heading with elegant line divider.
 * Used across all storefront themes for consistent luxury feel.
 */
export default function SectionHeading({ title, slug, linkTo, className = "" }: SectionHeadingProps) {
  return (
    <div className={`flex flex-col items-center mb-4 ${className}`}>
      <div className="flex items-center justify-between w-full">
        <div className="flex-1" />
        <h2
          className="text-base sm:text-lg font-bold tracking-wide whitespace-nowrap text-center"
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
              className="text-xs font-semibold flex items-center gap-0.5 transition-opacity hover:opacity-70"
              style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
            >
              View All <ChevronRight className="h-3.5 w-3.5" />
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
