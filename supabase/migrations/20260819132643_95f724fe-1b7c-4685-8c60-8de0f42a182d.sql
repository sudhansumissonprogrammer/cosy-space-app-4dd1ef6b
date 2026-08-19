-- 1) WhatsApp-exclusive ₹100 coupon must be auto-apply so recovery links honour it
UPDATE public.coupons SET auto_apply = true
WHERE store_id = '04010cad-1cbe-40ac-b818-07d9a79c1bf7' AND code = 'FLAT100';

-- 2) Put serdiyajewels on the same modern checkout as serdiyajewellers
UPDATE public.stores SET checkout_v2_enabled = true
WHERE id = '04010cad-1cbe-40ac-b818-07d9a79c1bf7';

-- 3) Copy reviews from serdiyajewellers -> serdiyajewels, in reverse order
WITH src AS (
  SELECT r.*, row_number() OVER (ORDER BY r.created_at ASC) AS rn,
         count(*) OVER () AS total,
         p.slug AS pslug, p.name AS pname
  FROM public.product_reviews r
  JOIN public.products p ON p.id = r.product_id
  WHERE r.store_id = '771a3012-393c-421a-b1c9-2ca918e6917f'
),
dates AS (
  SELECT row_number() OVER (ORDER BY created_at ASC) AS rn, created_at
  FROM public.product_reviews
  WHERE store_id = '771a3012-393c-421a-b1c9-2ca918e6917f'
),
mapped AS (
  SELECT s.*, d.created_at AS rev_created_at,
    COALESCE(
      (SELECT p2.id FROM public.products p2
        WHERE p2.store_id = '04010cad-1cbe-40ac-b818-07d9a79c1bf7' AND p2.slug = s.pslug LIMIT 1),
      (SELECT p3.id FROM public.products p3
        WHERE p3.store_id = '04010cad-1cbe-40ac-b818-07d9a79c1bf7' AND p3.name = s.pname
        ORDER BY p3.created_at ASC LIMIT 1)
    ) AS target_product_id
  FROM src s
  JOIN dates d ON d.rn = (s.total + 1 - s.rn)
)
INSERT INTO public.product_reviews
  (product_id, store_id, customer_name, rating, review_text, is_verified, created_at, media, title, is_hidden, pinned_rank)
SELECT target_product_id, '04010cad-1cbe-40ac-b818-07d9a79c1bf7', customer_name, rating, review_text,
       is_verified, rev_created_at, media, title, COALESCE(is_hidden,false),
       CASE WHEN pinned_rank IS NULL THEN NULL ELSE (total + 1 - pinned_rank)::int END
FROM mapped
WHERE target_product_id IS NOT NULL;

-- 4) Copy trust videos, reversed order
WITH src AS (
  SELECT v.*, row_number() OVER (ORDER BY COALESCE(v.sort_order,0) ASC, v.created_at ASC) AS rn,
         count(*) OVER () AS total
  FROM public.store_trust_videos v
  WHERE v.store_id = '771a3012-393c-421a-b1c9-2ca918e6917f'
)
INSERT INTO public.store_trust_videos
  (store_id, video_url, poster_url, title, cta_label, cta_target, sort_order, is_active)
SELECT '04010cad-1cbe-40ac-b818-07d9a79c1bf7', video_url, poster_url, title, cta_label, cta_target,
       (total - rn)::int, is_active
FROM src;