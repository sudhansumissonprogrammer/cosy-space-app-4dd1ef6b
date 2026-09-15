import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyStore } from "@/hooks/useMyStore";
import { useAdminStoreView } from "@/hooks/useAdminStoreView";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Trash2,
  Pin,
  PinOff,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Star,
  Loader2,
  Pencil,
  Plus,
  CheckCircle2,
} from "lucide-react";
import EditReviewDialog from "@/components/dashboard/EditReviewDialog";

interface ReviewRow {
  id: string;
  product_id: string | null;
  customer_name: string;
  rating: number;
  title: string | null;
  review_text: string | null;
  is_verified: boolean;
  is_hidden: boolean;
  created_at: string;
  media: any;
  pinned_rank: number | null;
  approval_status: "pending" | "approved";
  products?: { name: string; slug: string } | null;
}

const MAX_PINNED = 8;

export default function StoreReviewsManager() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const { data: ownStore, isLoading } = useMyStore();
  const { adminStore } = useAdminStoreView(ownStore, isLoading);
  const store =
    ownStore && (ownStore.slug === storeSlug || ownStore.id === storeSlug)
      ? ownStore
      : adminStore;
  const storeId = store?.id;
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [adding, setAdding] = useState(false);


  const { data: rows = [], refetch } = useQuery({
    queryKey: ["dashboard-reviews", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select(
          "id,product_id,customer_name,rating,title,review_text,is_verified,is_hidden,approval_status,created_at,media,pinned_rank,products(name,slug)"
        )
        .eq("store_id", storeId!)
        .order("pinned_rank", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as ReviewRow[];
    },
  });

  const pinned = useMemo(
    () =>
      [...rows]
        .filter((r) => r.approval_status === "approved" && r.pinned_rank !== null && r.pinned_rank !== undefined)
        .sort((a, b) => (a.pinned_rank ?? 99) - (b.pinned_rank ?? 99)),
    [rows]
  );
  const pending = useMemo(() => rows.filter((r) => r.approval_status === "pending"), [rows]);
  const unpinned = useMemo(
    () => rows.filter((r) => r.approval_status === "approved" && (r.pinned_rank === null || r.pinned_rank === undefined)),
    [rows]
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-reviews", storeId] });
    qc.invalidateQueries({ queryKey: ["store-pdp-reviews", storeId] });
  };

  async function withBusy(id: string, fn: () => Promise<any>) {
    setBusyId(id);
    try {
      await fn();
      await refetch();
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function pin(row: ReviewRow) {
    if (pinned.length >= MAX_PINNED) {
      toast.error(`Only ${MAX_PINNED} reviews can be featured. Unpin one first.`);
      return;
    }
    const nextRank = (pinned[pinned.length - 1]?.pinned_rank ?? 0) + 1;
    await withBusy(row.id, async () => {
      const { error } = await supabase
        .from("product_reviews")
        .update({ pinned_rank: nextRank, is_hidden: false })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Featured on PDP");
    });
  }

  async function unpin(row: ReviewRow) {
    await withBusy(row.id, async () => {
      const { error } = await supabase
        .from("product_reviews")
        .update({ pinned_rank: null })
        .eq("id", row.id);
      if (error) throw error;
      // Compact remaining ranks (1..n)
      const rest = pinned.filter((p) => p.id !== row.id);
      await Promise.all(
        rest.map((r, i) =>
          supabase.from("product_reviews").update({ pinned_rank: i + 1 }).eq("id", r.id)
        )
      );
    });
  }

  async function move(row: ReviewRow, dir: -1 | 1) {
    const idx = pinned.findIndex((p) => p.id === row.id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= pinned.length) return;
    const other = pinned[swapIdx];
    await withBusy(row.id, async () => {
      // Swap ranks safely (avoid unique conflicts by staging one to a high value)
      const rowRank = row.pinned_rank;
      const otherRank = other.pinned_rank;
      if (rowRank === null || otherRank === null) return;
      await supabase.from("product_reviews").update({ pinned_rank: 9999 }).eq("id", row.id);
      await supabase.from("product_reviews").update({ pinned_rank: rowRank }).eq("id", other.id);
      await supabase.from("product_reviews").update({ pinned_rank: otherRank }).eq("id", row.id);
    });
  }

  async function toggleHidden(row: ReviewRow) {
    await withBusy(row.id, async () => {
      const { error } = await supabase
        .from("product_reviews")
        .update({ is_hidden: !row.is_hidden, pinned_rank: !row.is_hidden ? null : row.pinned_rank })
        .eq("id", row.id);
      if (error) throw error;
    });
  }

  async function approve(row: ReviewRow) {
    await withBusy(row.id, async () => {
      const { error } = await supabase
        .from("product_reviews")
        .update({ approval_status: "approved", is_hidden: false })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Review approved and published");
    });
  }

  async function del(row: ReviewRow) {
    if (!confirm(`Delete review by ${row.customer_name}? This cannot be undone.`)) return;
    await withBusy(row.id, async () => {
      const { error } = await supabase.from("product_reviews").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Review deleted");
    });
  }

  function Row({ row, showMoveButtons, isPending }: { row: ReviewRow; showMoveButtons?: boolean; isPending?: boolean }) {
    const busy = busyId === row.id;
    const isPinned = row.pinned_rank !== null && row.pinned_rank !== undefined;
    const mediaArr = Array.isArray(row.media) ? row.media : [];
    const firstMedia = mediaArr[0];
    const canPinMore = pinned.length < MAX_PINNED;
    return (
      <Card className="p-3 sm:p-4">
        <div className="flex gap-3">
          {firstMedia?.url ? (
            firstMedia.type === "video" ? (
              <video
                src={firstMedia.url}
                className="h-16 w-16 shrink-0 rounded-lg object-cover bg-black"
                muted
                playsInline
              />
            ) : (
              <img
                src={firstMedia.url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover"
                loading="lazy"
              />
            )
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Star className="h-6 w-6" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold">{row.customer_name}</span>
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                {Array.from({ length: row.rating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-current" />
                ))}
              </span>
              {row.is_verified && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">Verified</Badge>
              )}
              {isPinned && (
                <Badge className="h-4 px-1 text-[9px]">#{row.pinned_rank} Featured</Badge>
              )}
              {row.is_hidden && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground">
                  Hidden
                </Badge>
              )}
            </div>
            {row.products?.name && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                on {row.products.name}
              </p>
            )}
            {row.review_text && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.review_text}</p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {isPending ? (
            <Button size="sm" disabled={busy} onClick={() => approve(row)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
            </Button>
          ) : isPinned ? (
            <>
              {showMoveButtons && (
                <>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => move(row, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => move(row, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => unpin(row)}>
                <PinOff className="mr-1 h-3.5 w-3.5" /> Unfeature
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="default"
              disabled={busy || !canPinMore || row.is_hidden}
              onClick={() => pin(row)}
              title={!canPinMore ? "Max 8 featured — unpin one first" : ""}
            >
              <Pin className="mr-1 h-3.5 w-3.5" /> Feature on PDP
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(row)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          {!isPending && <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleHidden(row)}>
            {row.is_hidden ? (
              <><Eye className="mr-1 h-3.5 w-3.5" /> Unhide</>
            ) : (
              <><EyeOff className="mr-1 h-3.5 w-3.5" /> Hide</>
            )}
          </Button>}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => del(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-sm text-muted-foreground">
             Approve shopper reviews, add reviews yourself, feature them in order, hide, or delete.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={!storeId}>
          <Plus className="mr-1 h-4 w-4" /> Add review
        </Button>
      </div>


      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Pending approval ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No reviews are waiting for approval.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((r) => <Row key={r.id} row={r} isPending />)}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Featured on PDP ({pinned.length}/{MAX_PINNED})
          </h2>
        </div>
        {pinned.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No featured reviews yet. Pin up to {MAX_PINNED} from the list below.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pinned.map((r) => (
              <Row key={r.id} row={r} showMoveButtons />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          All reviews ({unpinned.length})
        </h2>
        {unpinned.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No other reviews.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {unpinned.map((r) => (
              <Row key={r.id} row={r} />
            ))}
          </div>
        )}
      </section>

      {editing && storeId && (
        <EditReviewDialog
          storeId={storeId}
          review={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refetch();
            invalidate();
          }}
        />
      )}

      {adding && storeId && (
        <EditReviewDialog
          storeId={storeId}
          review={null}
          onClose={() => setAdding(false)}
          onSaved={() => {
            refetch();
            invalidate();
          }}
        />
      )}

    </div>
  );
}
