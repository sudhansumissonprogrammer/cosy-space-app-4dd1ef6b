import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ParcelPhoto({ orderId }: { orderId: string }) {
  const { data } = useQuery({
    queryKey: ["parcel-photo", orderId],
    staleTime: 4 * 60 * 1000,
    queryFn: async () => {
      const form = new FormData();
      form.append("action", "photo");
      form.append("order_id", orderId);
      const { data: result, error } = await supabase.functions.invoke("parcel-label-scan", { body: form });
      if (error) throw error;
      return typeof result?.photo_url === "string" ? result.photo_url : null;
    },
  });

  if (!data) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" /> Parcel photo
      </div>
      <a href={data} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-muted">
        <img src={data} alt="Parcel label" loading="lazy" className="max-h-72 w-full object-contain" />
      </a>
    </div>
  );
}