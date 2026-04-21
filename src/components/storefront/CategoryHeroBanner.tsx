interface Props {
  name: string;
  imageUrl?: string | null;
  count?: number;
}

/** Slim gradient hero banner for category pages. Pure CSS — no extra requests when no image. */
export default function CategoryHeroBanner({ name, imageUrl, count }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl mb-4 h-24 sm:h-32 flex items-center px-5"
      style={{
        background: imageUrl
          ? `linear-gradient(90deg, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 65%, transparent), transparent), url(${imageUrl}) center/cover`
          : `linear-gradient(135deg, color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 18%, transparent), color-mix(in srgb, var(--storefront-primary, hsl(var(--primary))) 4%, transparent))`,
      }}
    >
      <div className="relative z-10">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">Category</div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground mt-0.5 drop-shadow-sm">
          {name}
        </h1>
        {typeof count === "number" && count > 0 && (
          <div className="text-[12px] font-medium text-foreground/70 mt-0.5">{count} products</div>
        )}
      </div>
    </div>
  );
}
