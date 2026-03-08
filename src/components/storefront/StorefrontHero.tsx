import { Store, BadgeCheck } from "lucide-react";
import type { StoreData } from "@/layouts/StorefrontLayout";

interface StorefrontHeroProps {
  store: StoreData;
}

export default function StorefrontHero({ store }: StorefrontHeroProps) {
  return (
    <section className="relative">
      {store.banner_url ? (
        <div className="h-56 w-full sm:h-72 lg:h-80">
          <img src={store.banner_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
        </div>
      ) : (
        <div className="h-56 w-full bg-gradient-to-br from-primary/20 via-accent to-primary/10 sm:h-72 lg:h-80">
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
        </div>
      )}
      <div className="absolute inset-0 flex items-end">
        <div className="mx-auto w-full max-w-6xl px-4 pb-6">
          <div className="flex items-end gap-4">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={store.name}
                className="h-20 w-20 rounded-2xl border-4 border-background object-cover shadow-lg sm:h-24 sm:w-24"
                loading="lazy"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-background bg-card shadow-lg sm:h-24 sm:w-24">
                <Store className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="mb-1 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{store.name}</h1>
                {store.is_verified && (
                  <BadgeCheck className="h-5 w-5 text-primary" />
                )}
              </div>
              {store.description && (
                <p className="mt-1 max-w-xl text-sm text-muted-foreground line-clamp-2">
                  {store.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
