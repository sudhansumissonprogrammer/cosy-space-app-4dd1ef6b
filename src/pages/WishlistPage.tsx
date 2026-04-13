import { Link, useOutletContext, useParams } from "react-router-dom";
import { Heart, Trash2, ShoppingCart, Package } from "lucide-react";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath } from "@/lib/subdomain";

export default function WishlistPage() {
  const store = useOutletContext<StoreData>();
  const { slug } = useParams<{ slug: string }>();
  const { items, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  const handleAddToCart = (item: typeof items[0]) => {
    addToCart({
      productId: item.productId,
      name: item.name,
      price: item.salePrice && item.salePrice < item.price ? item.salePrice : item.price,
      image: item.image,
    });
    toast.success(`${item.name} added to cart`);
  };

  const handleRemove = (item: typeof items[0]) => {
    removeFromWishlist(item.productId);
    toast.success("Removed from wishlist");
  };

  return (
    <div className="mx-auto max-w-6xl lg:max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center gap-2">
        <Heart className="h-5 w-5 text-destructive" />
        <h1 className="text-xl font-bold text-foreground">
          My Wishlist
          {items.length > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({items.length} {items.length === 1 ? "item" : "items"})
            </span>
          )}
        </h1>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card">
          <Heart className="h-20 w-20 text-muted-foreground/20" />
          <p className="text-lg font-semibold text-foreground">Your wishlist is empty</p>
          <p className="text-sm text-muted-foreground">Save items you love to find them easily later</p>
          <Button asChild variant="outline">
            <Link to={storefrontPath(slug!, "")}>Continue Shopping</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const discountPercent = item.salePrice && item.salePrice < item.price
              ? Math.round(((item.price - item.salePrice) / item.price) * 100)
              : null;

            return (
              <div key={item.productId} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                {/* Image */}
                <Link
                  to={storefrontPath(slug!, `product/${item.slug || item.productId}`)}
                  className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-xl bg-secondary/40"
                >
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </Link>

                {/* Details */}
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    {item.category && (
                      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        {item.category}
                      </p>
                    )}
                    <Link to={storefrontPath(slug!, `product/${item.slug || item.productId}`)}>
                      <h3 className="text-xs font-bold text-foreground line-clamp-2">{item.name}</h3>
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {item.salePrice && item.salePrice < item.price ? (
                        <>
                          <span className="text-sm font-extrabold text-foreground">₹{item.salePrice.toFixed(0)}</span>
                          <span className="text-[10px] text-muted-foreground line-through">₹{item.price.toFixed(0)}</span>
                          {discountPercent && (
                            <span className="rounded bg-success px-1 py-px text-[9px] font-bold text-success-foreground">
                              {discountPercent}% off
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm font-extrabold text-foreground">₹{item.price.toFixed(0)}</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleAddToCart(item)}
                      className="btn-gold flex h-8 flex-1 items-center justify-center gap-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest"
                    >
                      <ShoppingCart className="h-3 w-3" />
                      Add to Cart
                    </button>
                    <button
                      onClick={() => handleRemove(item)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
