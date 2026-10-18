import { supabase } from "@/integrations/supabase/client";

export async function fetchOwnedReviewStore(userId: string, routeStore: string) {
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(routeStore);
  const { data, error } = await supabase.from("stores").select("id,slug,name")
    .eq("owner_id", userId).eq(isId ? "id" : "slug", routeStore).maybeSingle();
  if (error) throw error;
  return data;
}