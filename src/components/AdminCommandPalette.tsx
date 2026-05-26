import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, ShoppingBag, CreditCard, BarChart3,
  MessageSquare, Settings, Wallet, Handshake, Activity, AlertTriangle,
  Menu, Store, User as UserIcon, Receipt,
} from "lucide-react";

const navItems = [
  { label: "Overview", path: "/admin", icon: LayoutDashboard, keywords: "home dashboard" },
  { label: "Users & Stores", path: "/admin/users-stores", icon: Users, keywords: "owners merchants" },
  { label: "Orders", path: "/admin/orders", icon: ShoppingBag, keywords: "sales" },
  { label: "Subscriptions", path: "/admin/subscriptions", icon: CreditCard, keywords: "billing plans" },
  { label: "Commission Wallets", path: "/admin/wallets", icon: Wallet, keywords: "balance" },
  { label: "Referral Partners", path: "/admin/partners", icon: Handshake, keywords: "affiliate" },
  { label: "Partner Payouts", path: "/admin/partners/payouts", icon: Handshake, keywords: "withdrawals" },
  { label: "Partner Audit", path: "/admin/partners/audit", icon: Handshake, keywords: "logs" },
  { label: "WhatsApp", path: "/admin/whatsapp", icon: MessageSquare, keywords: "chat messages" },
  { label: "Analytics", path: "/admin/analytics", icon: BarChart3, keywords: "stats metrics" },
  { label: "Usage Monitor", path: "/admin/usage", icon: Activity, keywords: "monitoring" },
  { label: "Error Logs", path: "/admin/error-logs", icon: AlertTriangle, keywords: "bugs errors" },
  { label: "Menu Control", path: "/admin/menu-config", icon: Menu, keywords: "config" },
  { label: "Settings", path: "/admin/settings", icon: Settings, keywords: "config platform" },
];

interface AdminCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  // Fetch search results — only when palette open AND query has 2+ chars
  const debounced = useDebounced(search, 200);
  const shouldSearch = open && debounced.trim().length >= 2;

  const { data: stores } = useQuery({
    queryKey: ["admin-cmdk-stores", debounced],
    enabled: shouldSearch,
    queryFn: async () => {
      const q = `%${debounced}%`;
      const { data } = await supabase
        .from("stores")
        .select("id, name, slug")
        .or(`name.ilike.${q},slug.ilike.${q}`)
        .limit(5);
      return data || [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-cmdk-users", debounced],
    enabled: shouldSearch,
    queryFn: async () => {
      const q = `%${debounced}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.${q},email.ilike.${q}`)
        .limit(5);
      return data || [];
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-cmdk-orders", debounced],
    enabled: shouldSearch,
    queryFn: async () => {
      const q = `%${debounced}%`;
      const asNum = Number(debounced);
      const filter = Number.isFinite(asNum) && /^\d+$/.test(debounced)
        ? `order_number.eq.${asNum},customer_name.ilike.${q}`
        : `customer_name.ilike.${q}`;
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, total_amount")
        .or(filter)
        .limit(5);
      return data || [];
    },
  });

  const go = (path: string) => { onOpenChange(false); setSearch(""); navigate(path); };

  const filteredNav = useMemo(() => {
    if (!search.trim()) return navItems;
    const q = search.toLowerCase();
    return navItems.filter((n) => n.label.toLowerCase().includes(q) || n.keywords.includes(q));
  }, [search]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, stores, users, orders..." value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {filteredNav.length > 0 && (
          <CommandGroup heading="Navigation">
            {filteredNav.map((item) => (
              <CommandItem key={item.path} value={`nav-${item.label}`} onSelect={() => go(item.path)}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {shouldSearch && (stores?.length || 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Stores">
              {stores!.map((s: any) => (
                <CommandItem key={s.id} value={`store-${s.id}`} onSelect={() => go(`/admin/users-stores?store=${s.id}`)}>
                  <Store className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">{s.name}</span>
                    <span className="text-xs text-muted-foreground">/{s.slug}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {shouldSearch && (users?.length || 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Users">
              {users!.map((u: any) => (
                <CommandItem key={u.id} value={`user-${u.id}`} onSelect={() => go(`/admin/users-stores?user=${u.id}`)}>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">{u.full_name || u.email || "Unnamed"}</span>
                    {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {shouldSearch && (orders?.length || 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Orders">
              {orders!.map((o: any) => (
                <CommandItem key={o.id} value={`order-${o.id}`} onSelect={() => go(`/admin/orders?order=${o.id}`)}>
                  <Receipt className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm">#{o.order_number}</span>
                    <span className="text-xs text-muted-foreground">{o.customer_name} · ₹{o.total_amount}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Tips">
          <CommandItem disabled>
            <span className="text-xs text-muted-foreground">Type 2+ characters to search records</span>
            <CommandShortcut>⌘K</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
