import { useEffect } from "react";
import { useNavigateTransition } from "@/hooks/useNavigateTransition";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function StoresList() {
  const { user } = useAuth();
  const { navigate } = useNavigateTransition();

  const { data: store, isLoading } = useQuery({
    queryKey: ["my-store", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, slug")
        .eq("owner_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (isLoading) return;
    if (store) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/dashboard/stores/create", { replace: true });
    }
  }, [store, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
