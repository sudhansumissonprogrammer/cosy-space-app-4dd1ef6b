import { useState, useEffect } from "react";
import { useStoreSlugParam } from "@/hooks/useStoreSlugParam";
import { useStoreData } from "@/hooks/useStoreData";
import { useStorePurge } from "@/hooks/useStorePurge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDefaultContent } from "@/lib/defaultPageContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, EyeOff, GripVertical,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SYSTEM_PAGES = [
  { page_type: "about_us", title: "About Us", display_order: 0 },
  { page_type: "contact", title: "Contact Us", display_order: 1 },
  { page_type: "return_policy", title: "Return & Refund Policy", display_order: 2 },
  { page_type: "shipping_policy", title: "Shipping Policy", display_order: 3 },
  { page_type: "privacy_policy", title: "Privacy Policy", display_order: 4 },
  { page_type: "terms", title: "Terms & Conditions", display_order: 5 },
];

export default function StorePages() {
  const { storeId, storeSlug } = useStoreSlugParam();
  const { data: store } = useStoreData(storeId);
  const queryClient = useQueryClient();
  const purgeStore = useStorePurge(storeId);
  const [seeded, setSeeded] = useState(false);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["store-pages", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("store_id", storeId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Auto-seed system pages on first load if none exist
  useEffect(() => {
    if (!storeId || !store || seeded || !pages) return;
    if (pages.length > 0) { setSeeded(true); return; }

    const seedPages = async () => {
      const rows = SYSTEM_PAGES.map((sp) => {
        // Use existing store data if available, otherwise generate default template
        let content = "";
        if (sp.page_type === "about_us") content = (store as any).about_us_text || "";
        if (sp.page_type === "return_policy") content = (store as any).return_policy || "";
        if (sp.page_type === "shipping_policy") content = (store as any).shipping_policy || "";
        // If no existing content, use the default template
        if (!content) {
          content = getDefaultContent(sp.page_type, store as any);
        }
        return {
          store_id: storeId,
          page_type: sp.page_type,
          title: sp.title,
          content,
          slug: sp.page_type.replace(/_/g, "-"),
          display_order: sp.display_order,
          is_active: true,
          image_url: sp.page_type === "about_us" ? ((store as any).about_us_image_url || null) : null,
        };
      });

      const { error } = await supabase.from("store_pages").insert(rows as any);
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] });
      }
      setSeeded(true);
    };
    seedPages();
  }, [storeId, store, pages, seeded, queryClient]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("store_pages")
        .update({ is_active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] });
      toast.success("Page status updated");
      purgeStore();
    },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] });
      toast.success("Page deleted");
      purgeStore();
    },
    onError: () => toast.error("Failed to delete page"),
  });

  const isSystemPage = (pageType: string) => pageType !== "custom";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/dashboard/stores/${storeSlug}/products`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Pages</h1>
            <p className="text-sm text-muted-foreground">Manage your storefront pages</p>
          </div>
        </div>
        <Button asChild>
          <Link to={`/dashboard/stores/${storeSlug}/pages/new`}>
            <Plus className="mr-2 h-4 w-4" /> Add Page
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {pages?.map((page: any) => (
          <Card key={page.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-foreground truncate">{page.title}</h3>
                  {isSystemPage(page.page_type) && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">System</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {page.content ? page.content.slice(0, 80) + (page.content.length > 80 ? "…" : "") : "No content yet"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={page.is_active}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: page.id, is_active: checked })}
                />
                <Button variant="ghost" size="icon" asChild>
                  <Link to={`/dashboard/stores/${storeSlug}/pages/${page.id}/edit`}>
                    <Edit className="h-4 w-4" />
                  </Link>
                </Button>
                {!isSystemPage(page.page_type) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Page</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{page.title}"? This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(page.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {(!pages || pages.length === 0) && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No pages yet. System pages will be created automatically.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
