UPDATE public.orders o
SET payment_method = 'payu'
WHERE o.payment_method = 'razorpay'
  AND o.razorpay_order_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.store_payment_config c
    WHERE c.store_id = o.store_id
      AND c.payment_methods ? 'razorpay'
  );