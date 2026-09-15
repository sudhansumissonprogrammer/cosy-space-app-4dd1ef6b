import { useState } from "react";
import { createPortal } from "react-dom";
import { Star, Loader2, X, ImagePlus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadReviewMedia, type ReviewMedia } from "@/lib/uploadReviewMedia";

interface Props {
  productId: string;
  storeId: string;
  productName?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const MAX_MEDIA = 5;

export default function WriteReviewDialog({ productId, storeId, productName, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [media, setMedia] = useState<ReviewMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const slots = MAX_MEDIA - media.length;
    if (slots <= 0) {
      toast.error(`You can add up to ${MAX_MEDIA} files`);
      return;
    }
    setUploading(true);
    const picked = Array.from(files).slice(0, slots);
    for (const file of picked) {
      try {
        const uploaded = await uploadReviewMedia(file, storeId);
        setMedia((m) => [...m, uploaded]);
      } catch (err: any) {
        toast.error(err?.message || "Could not upload file");
      }
    }
    setUploading(false);
  };

  const submit = async () => {
    if (rating === 0) return toast.error("Please select a star rating");
    if (!name.trim()) return toast.error("Please enter your name");
    setSubmitting(true);
    const baseReview = {
      product_id: productId,
      store_id: storeId,
      customer_name: name.trim().slice(0, 50),
      rating,
      title: title.trim() ? title.trim().slice(0, 80) : null,
      review_text: text.trim() ? text.trim().slice(0, 1000) : null,
    };
    const reviewMedia = media.length ? media.map((item) => [item]) : [[]];
    const { error } = await supabase.from("product_reviews").insert(
      reviewMedia.map((itemMedia) => ({ ...baseReview, media: itemMedia as any })),
    );
    setSubmitting(false);
    if (error) {
      console.error("[review] insert failed", error);
      toast.error(error.message || "Could not submit your review. Please try again.");
      return;
    }

    toast.success("Thanks! Your review was submitted for approval.");
    onSubmitted();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483100] flex items-end sm:items-center justify-center bg-foreground/60 p-0 sm:p-4" onClick={onClose}>

      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-xl animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-5 py-3.5">
          <div>
            <h3 className="text-base font-bold text-foreground">Write a review</h3>
            {productName && <p className="text-xs text-muted-foreground line-clamp-1">{productName}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-accent">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Your rating *</label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-label={`${s} star`}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(s)}
                  className="p-0.5 transition-transform active:scale-90"
                >
                  <Star className={`h-8 w-8 ${s <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Your name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="e.g. Priya S."
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Headline</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Loved the quality!"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted-foreground">Your review</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Share how the product looks, fits and feels…"
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Add photos or video ({media.length}/{MAX_MEDIA})
            </label>
            <div className="flex flex-wrap gap-2">
              {media.map((m, i) => (
                <div key={m.url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                  {m.type === "video" ? (
                    <video src={m.url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                  <button
                    onClick={() => setMedia((arr) => arr.filter((_, idx) => idx !== i))}
                    aria-label="Remove"
                    className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5"
                  >
                    <X className="h-3.5 w-3.5 text-foreground" />
                  </button>
                </div>
              ))}
              {media.length < MAX_MEDIA && (
                <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground hover:bg-accent">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span className="text-[10px] font-medium">{uploading ? "Uploading" : "Add"}</span>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    multiple
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ""; }}
                  />
                </label>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Photos up to 8MB, video up to 40MB.</p>
          </div>

          <button
            onClick={submit}
            disabled={submitting || uploading || rating === 0 || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {submitting ? "Posting…" : "Post review"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
