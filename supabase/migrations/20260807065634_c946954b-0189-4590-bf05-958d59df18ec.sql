UPDATE public.platform_wa_templates
SET body_text = 'Hi {{1}} 👋

Your order from *{{2}}* has been shipped and is on its way.

📦 Item: *{{3}}*
🚛 Courier: *{{4}}*
🔖 Tracking number: *{{5}}*
💳 {{6}}

Tap below to see live tracking updates for your parcel.',
    variables = ARRAY['customer_name','store_name','product_name','courier_name','tracking_number','payment_status_line','cta_token']::text[],
    updated_at = now()
WHERE name IN ('order_shipped_v3','order_shipped_v3_img');