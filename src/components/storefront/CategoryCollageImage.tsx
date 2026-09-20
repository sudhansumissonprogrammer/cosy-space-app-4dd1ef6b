import { Tag } from "lucide-react";
import { optimizeImageUrl } from "@/lib/imageOptimize";

export interface StorefrontCategoryImage {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  collage_image_urls?: string[] | null;
}

interface Props {
  category: StorefrontCategoryImage;
  size?: number;
  className?: string;
}

export default function CategoryCollageImage({ category, size = 300, className = "h-full w-full object-cover" }: Props) {
  const collage = Array.isArray(category.collage_image_urls)
    ? category.collage_image_urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0).slice(0, 4)
    : [];
  const slots = collage.length > 0
    ? [...collage, ...Array(Math.max(0, 4 - collage.length)).fill(category.image_url || collage[0])].slice(0, 4)
    : [];

  if (slots.length > 0) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-border" role="img" aria-label={`${category.name} products`}>
        {slots.map((url, index) => (
          <img
            key={`${url}-${index}`}
            src={optimizeImageUrl(url, Math.max(96, Math.ceil(size / 2)), 78)}
            alt=""
            className={className}
            loading="lazy"
            decoding="async"
            width={Math.ceil(size / 2)}
            height={Math.ceil(size / 2)}
          />
        ))}
      </div>
    );
  }

  if (category.image_url) {
    return <img src={optimizeImageUrl(category.image_url, size, 82)} alt={category.name} className={className} loading="lazy" decoding="async" width={size} height={size} />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--accent)))" }}>
      <Tag className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "var(--storefront-text, hsl(var(--muted-foreground)))", opacity: 0.5 }} />
    </div>
  );
}