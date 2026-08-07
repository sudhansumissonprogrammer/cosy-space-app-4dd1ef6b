UPDATE public.platform_wa_templates
SET variables = ARRAY['customer_name','store_name','product_name','courier_name','tracking_number','paid_summary','cod_due_line']
WHERE name IN ('order_shipped_v3','order_shipped_v3_img');