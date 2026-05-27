/**
 * NavIconPicker — admin UI for choosing which icon represents each nav slot.
 * Renders one row per slot, with each option's real icon previewed inline.
 */
import { ICON_OPTIONS, DEFAULT_ICONS, type NavSlot } from "@/lib/navIconRegistry";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

const SLOT_LABELS: Record<NavSlot, string> = {
  home: "Home",
  shop: "Shop",
  categories: "Categories",
  cart: "Cart",
  orders: "Orders",
  search: "Search",
  menu: "Menu",
  wishlist: "Wishlist",
  account: "Account",
};

const SLOT_ORDER: NavSlot[] = [
  "home", "shop", "categories", "cart", "orders",
  "search", "menu", "wishlist", "account",
];

interface Props {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

export default function NavIconPicker({ value, onChange }: Props) {
  const pick = (slot: NavSlot, id: string) => {
    const next = { ...value };
    if (id === DEFAULT_ICONS[slot]) delete next[slot];
    else next[slot] = id;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({})}
          className="h-7 gap-1.5 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          Reset all
        </Button>
      </div>
      <div className="space-y-2">
        {SLOT_ORDER.map((slot) => {
          const current = value[slot] || DEFAULT_ICONS[slot];
          return (
            <div
              key={slot}
              className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-3 py-2"
            >
              <span className="w-20 shrink-0 text-xs font-medium text-foreground">
                {SLOT_LABELS[slot]}
              </span>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {ICON_OPTIONS[slot].map((opt) => {
                  const active = opt.id === current;
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => pick(slot, opt.id)}
                      title={opt.label}
                      className={`flex h-9 w-9 items-center justify-center rounded-md border transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      aria-label={`${SLOT_LABELS[slot]}: ${opt.label}`}
                      aria-pressed={active}
                    >
                      <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.8} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
