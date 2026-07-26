DELETE FROM public.order_items oi
USING (
  SELECT order_id, product_id, max(ctid) AS keep_ctid
  FROM public.order_items
  WHERE order_id IN ('55d7c77f-a132-4efb-bd8a-21b38eb66069','f474158f-d00c-467b-aa0a-fc8599ff2039')
  GROUP BY order_id, product_id
) k
WHERE oi.order_id = k.order_id
  AND oi.product_id IS NOT DISTINCT FROM k.product_id
  AND oi.ctid <> k.keep_ctid;