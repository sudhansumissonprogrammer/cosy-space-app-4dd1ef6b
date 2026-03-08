import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Store, ExternalLink, Package, ShoppingBag, Users, Settings } from "lucide-react";

export default function StoresList() {
  const { user } = useAuth();

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Stores</h1>
          <p className="text-sm text-muted-foreground">Manage your storefronts</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/stores/create">
            <Plus className="mr-2 h-4 w-4" />
            New Store
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : stores && stores.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Card key={store.id} className="overflow-hidden">
              {store.banner_url && (
                <div className="h-24 w-full">
                  <img src={store.banner_url} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                {store.logo_url ? (
                  <img src={store.logo_url} alt="" className="h-10 w-10 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <Store className="h-5 w-5 text-accent-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base">{store.name}</CardTitle>
                  <p className="truncate text-xs text-muted-foreground">/store/{store.slug}</p>
                </div>
              </CardHeader>
              <CardContent>
                {store.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{store.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/store/${store.slug}`} target="_blank">
                      <ExternalLink className="mr-1 h-3 w-3" /> View
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/dashboard/stores/${store.id}/products`}>
                      <Package className="mr-1 h-3 w-3" /> Products
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/dashboard/stores/${store.id}/orders`}>
                      <ShoppingBag className="mr-1 h-3 w-3" /> Orders
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/dashboard/stores/${store.id}/customers`}>
                      <Users className="mr-1 h-3 w-3" /> Customers
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/dashboard/stores/${store.id}/settings`}>
                      <Settings className="mr-1 h-3 w-3" /> Settings
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-[200px] flex-col items-center justify-center gap-3">
            <Store className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">No stores yet</p>
            <Button asChild>
              <Link to="/dashboard/stores/create">
                <Plus className="mr-2 h-4 w-4" />
                Create your first store
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
