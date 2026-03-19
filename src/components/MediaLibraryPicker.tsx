import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Image as ImageIcon, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MediaItem {
  id: string;
  file_url: string;
  file_name: string;
}

interface MediaLibraryPickerProps {
  storeId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  multiple?: boolean;
}

export default function MediaLibraryPicker({ storeId, open, onClose, onSelect, multiple = false }: MediaLibraryPickerProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: media, isLoading } = useQuery({
    queryKey: ["media-library", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("media_library")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as MediaItem[];
    },
    enabled: !!storeId && open,
  });

  const filteredMedia = search.trim()
    ? media?.filter((m) => m.file_name.toLowerCase().includes(search.toLowerCase()))
    : media;

  const toggleSelect = (url: string) => {
    if (multiple) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.has(url) ? next.delete(url) : next.add(url);
        return next;
      });
    } else {
      onSelect([url]);
      onClose();
    }
  };

  const confirmMultiple = () => {
    onSelect(Array.from(selected));
    setSelected(new Set());
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setSelected(new Set()); } }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose from Library</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search images..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="grid grid-cols-4 gap-2 p-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : !filteredMedia || filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {search ? "No images found" : "No images in library. Upload from the Media Library page."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 p-1">
              {filteredMedia.map((item) => {
                const isSelected = selected.has(item.file_url);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSelect(item.file_url)}
                    className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                      isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                    }`}
                  >
                    <img src={item.file_url} alt={item.file_name} className="h-full w-full object-cover" loading="lazy" />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-4 w-4" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {multiple && selected.size > 0 && (
          <div className="flex justify-end border-t pt-3">
            <Button onClick={confirmMultiple}>
              Add {selected.size} image{selected.size > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
