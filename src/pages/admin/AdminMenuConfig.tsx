import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Menu, Eye, EyeOff, Clock } from "lucide-react";

interface MenuItem {
  id: string;
  menu_key: string;
  menu_label: string;
  status: string;
  display_order: number;
}

const STATUS_CONFIG = {
  visible: { label: "Visible", icon: Eye, color: "text-green-600" },
  hidden: { label: "Hidden", icon: EyeOff, color: "text-destructive" },
  coming_soon: { label: "Coming Soon", icon: Clock, color: "text-amber-600" },
} as const;

export default function AdminMenuConfig() {
  useDocumentTitle("Menu Control · Admin");
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-menu-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dashboard_menu_config")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data as MenuItem[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("dashboard_menu_config")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-menu-config"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-menu-config"] });
      toast.success("Menu updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Menu className="h-5 w-5" />
          Dashboard Menu Control
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which menu items store owners can see. Hidden items are removed entirely, Coming Soon items show a badge and are disabled.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Store Owner Dashboard Menus</CardTitle>
          <CardDescription>Changes apply instantly for all merchants</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="divide-y">
              {items?.map((item) => {
                const statusInfo = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.visible;
                const StatusIcon = statusInfo.icon;
                return (
                  <div key={item.id} className="flex items-center justify-between py-3 gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusIcon className={`h-4 w-4 shrink-0 ${statusInfo.color}`} />
                      <span className="text-sm font-medium truncate">{item.menu_label}</span>
                      {item.status === "coming_soon" && (
                        <Badge variant="outline" className="text-[10px] shrink-0 border-amber-300 text-amber-600">
                          Coming Soon
                        </Badge>
                      )}
                      {item.status === "hidden" && (
                        <Badge variant="outline" className="text-[10px] shrink-0 border-destructive/30 text-destructive">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <Select
                      value={item.status}
                      onValueChange={(value) => updateMutation.mutate({ id: item.id, status: value })}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visible">
                          <span className="flex items-center gap-1.5">
                            <Eye className="h-3 w-3 text-green-600" /> Visible
                          </span>
                        </SelectItem>
                        <SelectItem value="hidden">
                          <span className="flex items-center gap-1.5">
                            <EyeOff className="h-3 w-3 text-destructive" /> Hidden
                          </span>
                        </SelectItem>
                        <SelectItem value="coming_soon">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-amber-600" /> Coming Soon
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
