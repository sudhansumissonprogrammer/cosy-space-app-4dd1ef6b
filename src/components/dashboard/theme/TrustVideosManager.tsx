/**
 * TrustVideosManager — dashboard UI for the floating storefront trust-video reel.
 *
 * Owners upload as many short clips as they want; each row gets a title,
 * a CTA label and a CTA target (category / product / custom path or URL).
 * Uploads preserve the original video bytes and land on the R2 CDN. Browser
 * re-encoding is intentionally avoided because it can damage frame cadence.
 */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { uploadCompressedVideo } from "@/lib/uploadCompressedVideo";

interface Row {
  id: string;
  video_url: string;
  poster_url: string | null;
  title: string | null;
  cta_label: string | null;
  cta_target: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function TrustVideosManager({ storeId }: { storeId?: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["store-trust-videos", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_trust_videos")
        .select("id,video_url,poster_url,title,cta_label,cta_target,sort_order,is_active")
        .eq("store_id", storeId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Row[];
    },
    enabled: !!storeId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["trust-video-categories", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id,name,slug")
        .eq("store_id", storeId!)
        .order("name");
      return (data || []) as { id: string; name: string; slug: string }[];
    },
    enabled: !!storeId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["trust-video-products", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,slug")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      return (data || []) as { id: string; name: string; slug: string }[];
    },
    enabled: !!storeId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["store-trust-videos", storeId] });

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || !storeId) return;
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) { toast.error("Please sign in again"); return; }

    setBusy(true);
    try {
      let order = rows.length;
      for (const file of Array.from(files)) {
        setStage(`Processing ${file.name}`);
        setProgress(0);
        const res = await uploadCompressedVideo(file, {
          userId,
          storeId,
          maxDurationSec: 90,
          onProgress: (p) => setProgress(Math.round(p * 100)),
          onStage: (s) => setStage(s === "compressing" ? "Optimising video…" : "Uploading…"),
        });
        const { error } = await (supabase as any).from("store_trust_videos").insert({
          store_id: storeId,
          video_url: res.videoUrl,
          poster_url: res.posterUrl || null,
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
          cta_label: null,
          cta_target: null,
          sort_order: order++,
          is_active: true,
        });
        if (error) throw error;
      }
      toast.success("Trust video added");
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      setProgress(0);
      setStage("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const patch = async (id: string, values: Partial<Row>) => {
    const { error } = await (supabase as any).from("store_trust_videos").update(values).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("store_trust_videos").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Video removed");
    refresh();
  };

  // Swapping the two sort_order values silently does nothing when several rows
  // share the same value (everything uploaded in one batch can end up at 0).
  // Reindex the whole list instead so the position always sticks.
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (!rows[index] || !rows[target]) return;

    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];

    // Optimistic: the card jumps immediately instead of after the round-trip.
    qc.setQueryData(["store-trust-videos", storeId], next.map((r, i) => ({ ...r, sort_order: i })));

    try {
      for (let i = 0; i < next.length; i++) {
        if (next[i].sort_order === i) continue;
        const { error } = await (supabase as any)
          .from("store_trust_videos")
          .update({ sort_order: i })
          .eq("id", next[i].id);
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not change the order");
    }
    refresh();
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        These play in the floating video button on your storefront. Videos load only when a shopper taps
        the button, so your pages stay fast. Keep clips under 90 seconds — source quality is preserved.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" disabled={busy || !storeId} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {busy ? `${stage || "Working"} ${progress}%` : "Upload videos"}
      </Button>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {!isLoading && rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center">
          <Video className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No trust videos yet. Upload your first clip.</p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex gap-3">
              <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-black">
                {r.poster_url ? (
                  <img src={r.poster_url} alt={r.title || "Trust video"} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <video src={r.video_url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  defaultValue={r.title || ""}
                  placeholder="Internal title"
                  className="h-8 text-xs"
                  onBlur={(e) => e.target.value !== (r.title || "") && patch(r.id, { title: e.target.value })}
                />
                <Input
                  defaultValue={r.cta_label || ""}
                  placeholder="Button text (leave empty for no button)"
                  className="h-8 text-xs"
                  onBlur={(e) => e.target.value !== (r.cta_label || "") && patch(r.id, { cta_label: e.target.value.trim() || null })}
                />

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Button goes to</Label>
                  <Select value={r.cta_target || "none"} onValueChange={(v) => patch(r.id, { cta_target: v === "none" ? null : v })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Choose destination" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="none">No button</SelectItem>
                      <SelectItem value="shop">All products</SelectItem>
                      <SelectItem value="categories">All categories</SelectItem>
                      <SelectItem value="reviews">Customer reviews</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={`category/${c.slug}`}>Category · {c.name}</SelectItem>
                      ))}
                      {products.map((p) => (
                        <SelectItem key={p.id} value={`product/${p.slug}`}>Product · {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Switch checked={r.is_active} onCheckedChange={(v) => patch(r.id, { is_active: v })} />
                    <span className="text-[11px] text-muted-foreground">{r.is_active ? "Live" : "Hidden"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
