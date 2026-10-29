export interface StoreReview {
  id: string;
  product_id: string | null;
  customer_name: string;
  rating: number;
  /** Unrated merchant photo, excluded from star scores and customer identity. */
  photo_only?: boolean;
  title: string | null;
  review_text: string | null;
  is_verified: boolean;
  created_at: string;
  media: { url: string; type: "image" | "video" }[];
  pinned_rank?: number | null;
  is_hidden?: boolean;
  approval_status?: "pending" | "approved";
  products?: { name: string; slug: string } | null;
}

export const REVIEW_SELECT =
  "id,product_id,customer_name,rating,title,review_text,is_verified,created_at,media,pinned_rank,is_hidden,approval_status";

export function normalizeReview(row: any): StoreReview {
  const raw = Array.isArray(row?.media) ? row.media : [];
  return {
    ...row,
    media: raw
      .filter((m: any) => m && typeof m.url === "string")
      .map((m: any) => ({ url: m.url, type: m.type === "video" ? "video" : "image" })),
  } as StoreReview;
}

export function formatReviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function ratingBreakdown(reviews: { rating: number }[]) {
  const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (counts[r.rating] !== undefined) counts[r.rating]++;
  });
  const rated = reviews.filter((r) => Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5);
  const total = rated.length;
  const average = total ? rated.reduce((s, r) => s + r.rating, 0) / total : 0;
  return { counts, total, average };
}
