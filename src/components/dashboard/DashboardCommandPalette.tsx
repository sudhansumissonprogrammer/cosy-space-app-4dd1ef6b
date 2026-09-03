import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList,
} from "@/components/ui/command";
import { buildDashboardNav, filterNavGroups } from "@/config/dashboardNav";
import { Sparkles } from "lucide-react";
import { useMenuConfig } from "@/hooks/useMenuConfig";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug?: string;
  onAskAssistant?: () => void;
  isCommissionMode?: boolean;
  isWhatsAppOnly?: boolean;
}

/**
 * Merchant ⌘K palette — parity with the admin panel. Reads the same
 * navigation source of truth as the sidebar and mobile menu.
 */
export default function DashboardCommandPalette({
  open, onOpenChange, storeSlug, isCommissionMode, isWhatsAppOnly, onAskAssistant,
}: Props) {
  const navigate = useNavigate();
  const { isVisible, isComingSoon } = useMenuConfig();

  const groups = useMemo(
    () => filterNavGroups(buildDashboardNav({ storeSlug, isCommissionMode, isWhatsAppOnly }), isVisible),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storeSlug, isCommissionMode, isWhatsAppOnly, isVisible],
  );

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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump to a page or setting…" />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        {onAskAssistant && (
          <CommandGroup heading="Help">
            <CommandItem
              value="ask assistant ai help how do i guide support"
              onSelect={() => {
                onOpenChange(false);
                onAskAssistant();
              }}
            >
              <Sparkles className="mr-2 h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 min-w-0 truncate">Ask the Store Assistant</span>
              <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:inline">
                Step-by-step help for anything in the dashboard
              </span>
            </CommandItem>
          </CommandGroup>
        )}
        {groups.map((group) => (
          <CommandGroup key={group.id} heading={group.title}>
            {group.items
              .filter((item) => !(item.menuKey && isComingSoon(item.menuKey)))
              .map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${group.title} ${item.description} ${item.keywords.join(" ")}`}
                  onSelect={() => {
                    navigate(item.path);
                    onOpenChange(false);
                  }}
                >
                  <item.icon className="mr-2 h-4 w-4 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{item.label}</span>
                  <span className="ml-2 hidden truncate text-xs text-muted-foreground sm:inline">
                    {item.description}
                  </span>
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
