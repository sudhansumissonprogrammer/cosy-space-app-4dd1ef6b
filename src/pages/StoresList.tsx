import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function StoresList() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Return null so the index.html #inline-skel spinner remains visible until
  // we redirect to /dashboard (or /dashboard/stores/create) — avoids a brief
  // blank spinner-on-spinner flash.
  return null;
}
