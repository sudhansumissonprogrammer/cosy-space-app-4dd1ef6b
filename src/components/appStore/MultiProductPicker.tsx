import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, X, Check } from "lucide-react";

interface Props {
  storeId?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  placeholder?: string;
}

interface Product { id: string; name: string; slug?: string; image_url?: string; price?: number; }

export default function MultiProductPicker({ storeId, value, onChange, max = 50, placeholder = "Search products..." }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: products } = useQuery({
    queryKey: ["appstore-multi-product-picker", storeId],
    enabled: !!storeId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id, name, slug, image_url, price")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data || []) as Product[];
    },
  });

  // Also fetch the selected ones so we can show their names even before opening
  const { data: selectedProducts } = useQuery({
    queryKey: ["appstore-selected-products", storeId, value.join(",")],
    enabled: !!storeId && value.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("products")
        .select("id, name, image_url")
        .in("id", value);
      return (data || []) as Product[];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    const query = q.trim().toLowerCase();
    if (!query) return products;
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [products, q]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((x) => x !== id));
    } else if (value.length < max) {
      onChange([...value, id]);
    }
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <span className="text-xs">
              {value.length === 0 ? placeholder : `${value.length} product${value.length === 1 ? "" : "s"} selected`}
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-2" align="start">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search..."
              className="pl-7 h-8 text-xs"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filtered.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">
                {products ? "No products match" : "Loading..."}
              </div>
            )}
            {filtered.map((p) => {
              const on = selectedSet.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={`flex items-center gap-2 w-full rounded-md p-1.5 text-left text-xs hover:bg-accent ${on ? "bg-primary/10" : ""}`}
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted shrink-0" />
                  )}
                  <span className="flex-1 truncate">{p.name}</span>
                  {on && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {value.length > 0 && selectedProducts && (
        <div className="flex flex-wrap gap-1">
          {selectedProducts.map((p) => (
            <Badge key={p.id} variant="secondary" className="text-[10px] gap-1 pr-1">
              {p.name}
              <button
                onClick={() => onChange(value.filter((x) => x !== p.id))}
                className="hover:text-destructive"
                aria-label={`Remove ${p.name}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}