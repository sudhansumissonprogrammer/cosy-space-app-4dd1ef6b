
-- Add order_count to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS order_count INTEGER NOT NULL DEFAULT 0;

-- Add customer_name to whatsapp_orders for capturing name at order time
ALTER TABLE public.whatsapp_orders ADD COLUMN customer_name TEXT;

-- Create trigger function to auto-upsert customer when a whatsapp order is created
CREATE OR REPLACE FUNCTION public.handle_whatsapp_order_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if we have a phone number
  IF NEW.customer_phone IS NOT NULL AND NEW.customer_phone != '' THEN
    INSERT INTO public.customers (store_id, email, name, phone, order_count)
    VALUES (
      NEW.store_id,
      COALESCE(NEW.customer_phone, '') || '@whatsapp',
      COALESCE(NEW.customer_name, 'WhatsApp Customer'),
      NEW.customer_phone,
      1
    )
    ON CONFLICT (store_id, email) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, customers.name),
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      order_count = customers.order_count + 1,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_whatsapp_order_created
  AFTER INSERT ON public.whatsapp_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_whatsapp_order_customer();
