
CREATE OR REPLACE FUNCTION public.get_co_purchased_products(_product_id uuid, _limit integer DEFAULT 4)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi2.product_id
  FROM order_items oi1
  JOIN order_items oi2 ON oi2.order_id = oi1.order_id
  WHERE oi1.product_id = _product_id
    AND oi2.product_id != _product_id
    AND oi2.product_id IS NOT NULL
  GROUP BY oi2.product_id
  ORDER BY COUNT(*) DESC
  LIMIT _limit;
$$;
