/**
 * Nav icon registry — single source of truth for customizable nav icons.
 * Used by mobile bottom navs (Classic / Modern / Streetwear V15) and the
 * mobile app header (menu / search / cart). All icons are statically
 * imported from lucide-react so swapping is synchronous with no flicker
 * and no async chunk fetch.
 */
import type { LucideIcon } from "lucide-react";
import {
  // Home
  Home, House, Tent, Castle, Building2,
  // Shop
  ShoppingBag, Store, Tag, Package, Shirt,
  // Categories
  LayoutGrid, Grid3x3, Boxes, Rows3, Component,
  // Cart
  ShoppingCart, ShoppingBasket, Briefcase, Backpack, HandPlatter,
  // Orders
  ClipboardList, ScrollText, ReceiptText, FileText, ListChecks,
  // Search
  Search, SearchCheck, ScanSearch, Telescope, Binoculars,
  // Menu
  Menu, AlignJustify, AlignLeft, MoreHorizontal, LayoutList,
  // Wishlist
  Heart, HeartHandshake, Bookmark, Star, Sparkle,
  // Account
  User, UserCircle, CircleUserRound, UserRound, IdCard,
} from "lucide-react";

export type NavSlot =
  | "home"
  | "shop"
  | "categories"
  | "cart"
  | "orders"
  | "search"
  | "menu"
  | "wishlist"
  | "account";

export interface IconOption {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export const ICON_OPTIONS: Record<NavSlot, IconOption[]> = {
  home: [
    { id: "home", label: "Classic", Icon: Home },
    { id: "house", label: "House", Icon: House },
    { id: "tent", label: "Tent", Icon: Tent },
    { id: "castle", label: "Castle", Icon: Castle },
    { id: "building", label: "Building", Icon: Building2 },
  ],
  shop: [
    { id: "bag", label: "Bag", Icon: ShoppingBag },
    { id: "store", label: "Store", Icon: Store },
    { id: "tag", label: "Tag", Icon: Tag },
    { id: "package", label: "Package", Icon: Package },
    { id: "shirt", label: "Shirt", Icon: Shirt },
  ],
  categories: [
    { id: "grid", label: "Grid", Icon: LayoutGrid },
    { id: "grid3", label: "3x3 Grid", Icon: Grid3x3 },
    { id: "boxes", label: "Boxes", Icon: Boxes },
    { id: "rows", label: "Rows", Icon: Rows3 },
    { id: "component", label: "Blocks", Icon: Component },
  ],
  cart: [
    { id: "cart", label: "Cart", Icon: ShoppingCart },
    { id: "basket", label: "Basket", Icon: ShoppingBasket },
    { id: "briefcase", label: "Briefcase", Icon: Briefcase },
    { id: "backpack", label: "Backpack", Icon: Backpack },
    { id: "platter", label: "Platter", Icon: HandPlatter },
  ],
  orders: [
    { id: "clipboard", label: "Clipboard", Icon: ClipboardList },
    { id: "scroll", label: "Scroll", Icon: ScrollText },
    { id: "receipt", label: "Receipt", Icon: ReceiptText },
    { id: "file", label: "File", Icon: FileText },
    { id: "checks", label: "Checks", Icon: ListChecks },
  ],
  search: [
    { id: "search", label: "Search", Icon: Search },
    { id: "search-check", label: "Search +", Icon: SearchCheck },
    { id: "scan", label: "Scan", Icon: ScanSearch },
    { id: "telescope", label: "Telescope", Icon: Telescope },
    { id: "binoculars", label: "Binoculars", Icon: Binoculars },
  ],
  menu: [
    { id: "menu", label: "Hamburger", Icon: Menu },
    { id: "justify", label: "Justify", Icon: AlignJustify },
    { id: "align-left", label: "Left", Icon: AlignLeft },
    { id: "more", label: "Dots", Icon: MoreHorizontal },
    { id: "list", label: "List", Icon: LayoutList },
  ],
  wishlist: [
    { id: "heart", label: "Heart", Icon: Heart },
    { id: "heart-hands", label: "Heart Hands", Icon: HeartHandshake },
    { id: "bookmark", label: "Bookmark", Icon: Bookmark },
    { id: "star", label: "Star", Icon: Star },
    { id: "sparkle", label: "Sparkle", Icon: Sparkle },
  ],
  account: [
    { id: "user", label: "User", Icon: User },
    { id: "user-circle", label: "User Circle", Icon: UserCircle },
    { id: "circle-user", label: "Round", Icon: CircleUserRound },
    { id: "user-round", label: "Avatar", Icon: UserRound },
    { id: "id", label: "ID Card", Icon: IdCard },
  ],
};

export const DEFAULT_ICONS: Record<NavSlot, string> = {
  home: "home",
  shop: "bag",
  categories: "grid",
  cart: "cart",
  orders: "clipboard",
  search: "search",
  menu: "menu",
  wishlist: "heart",
  account: "user",
};

/** Resolve a slot id to its lucide component, with safe fallback. */
export function resolveNavIcon(slot: NavSlot, pickedId?: string | null): LucideIcon {
  const id = pickedId || DEFAULT_ICONS[slot];
  const opts = ICON_OPTIONS[slot];
  const found = opts.find((o) => o.id === id);
  return (found ?? opts[0]).Icon;
}
