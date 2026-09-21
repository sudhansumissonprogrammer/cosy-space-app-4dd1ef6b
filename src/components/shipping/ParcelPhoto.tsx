import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function ParcelPhoto({ orderId }: { orderId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["parcel-photo", orderId],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const form = new FormData();
      form.append("action", "photo");
      form.append("order_id", orderId);
      const { data: result, error } = await supabase.functions.invoke("parcel-label-scan", { body: form });
      if (error) throw error;
      return typeof result?.photo_url === "string" ? result.photo_url : null;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-lg border bg-muted/30 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading parcel photo…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <span>Parcel photo could not be loaded.</span>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" disabled={isFetching} onClick={() => void refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" /> Parcel photo
      </div>
      <a href={data} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-muted/30">
        <img src={data} alt="Uploaded parcel label" loading="lazy" className="max-h-80 w-full object-contain" />
      </a>
    </div>
  );
}