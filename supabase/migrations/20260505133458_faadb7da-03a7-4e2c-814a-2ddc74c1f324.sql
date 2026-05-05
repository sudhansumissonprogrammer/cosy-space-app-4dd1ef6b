ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

-- Fix the specific stuck order (Order #261, captured payment pay_SlcmB9T7DvrMPI ₹100)
UPDATE public.orders
SET status = 'partially_paid',
    payment_method = 'razorpay',
    notes = COALESCE(notes,'') || E'\nRazorpay Payment ID: pay_SlcmB9T7DvrMPI (manually reconciled — captured ₹100 advance)',
    updated_at = now()
WHERE id = '8e2cc7d3-e508-4e4c-baed-be994b152563'
  AND status NOT IN ('partially_paid','confirmed','delivered');