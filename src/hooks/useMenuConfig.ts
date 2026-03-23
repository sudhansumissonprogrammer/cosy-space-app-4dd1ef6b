import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MenuStatus = "visible" | "hidden" | "coming_soon";

export interface MenuConfigItem {
  menu_key: string;
  menu_label: string;
  status: MenuStatus;
}

export function useMenuConfig() {
  const { data: menuConfig } = useQuery({
    queryKey: ["dashboard-menu-config"],
    staleTime: 10 * 60 * 1000, // 10 min cache
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dashboard_menu_config")
        .select("menu_key, menu_label, status")
        .order("display_order");
      if (error) throw error;
      return data as MenuConfigItem[];
    },
  });

  const configMap = new Map<string, MenuStatus>();
  menuConfig?.forEach((item) => configMap.set(item.menu_key, item.status as MenuStatus));

  const getStatus = (key: string): MenuStatus => configMap.get(key) ?? "visible";
  const isVisible = (key: string) => getStatus(key) !== "hidden";
  const isComingSoon = (key: string) => getStatus(key) === "coming_soon";

  return { menuConfig, getStatus, isVisible, isComingSoon };
}
