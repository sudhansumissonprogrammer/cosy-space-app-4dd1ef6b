import { Tag } from "lucide-react";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { useImageActivation } from "@/hooks/useImageActivation";

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
  const { ref, active } = useImageActivation();
  const collage = Array.isArray(category.collage_image_urls)
    ? Array.from(new Set(category.collage_image_urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0))).slice(0, 4)
    : [];

  if (collage.length === 4) {
    return (
      <div ref={ref} className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-border" role="img" aria-label={`${category.name} products`}>
        {collage.map((url) => (
          <img
            key={url}
            src={active ? optimizeImageUrl(url, Math.max(96, Math.ceil(size / 2)), 78) : undefined}
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

  const fallbackImage = category.image_url || collage[0];
  if (fallbackImage) {
    return <div ref={ref} className="h-full w-full"><img src={active ? optimizeImageUrl(fallbackImage, size, 82) : undefined} alt={category.name} className={className} loading="lazy" decoding="async" width={size} height={size} /></div>;
  }

  return (
    <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--accent)))" }}>
      <Tag className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: "var(--storefront-text, hsl(var(--muted-foreground)))", opacity: 0.5 }} />
    </div>
  );
}