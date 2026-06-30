
-- 1) order_confirmation_v2 — body vars unchanged, button URL fixed.
UPDATE public.platform_wa_templates SET
  body_text = 'Hi {{1}} 👋,

✅ Your order with *{{2}}* has been confirmed.

📦 Product: *{{3}}*
🛍️ Items: {{4}}
💰 Total: *{{5}}*
💳 {{6}}

🚚 Expected Delivery: *{{7}}*

Thank you for shopping with us! 💗
Tap below to view your order.',
  buttons = '[{"type":"URL","text":"View Order","url":"https://shopbanao.in/r/{{1}}"}]'::jsonb,
  variables = ARRAY['customer_name','store_name','product_name','item_count','order_total','payment_status_line','expected_delivery'],
  meta_status = NULL,
  meta_template_id = NULL,
  meta_rejected_reason = NULL,
  submitted_at = NULL,
  last_synced_at = NULL
WHERE name = 'order_confirmation_v2';

-- 2) order_shipped_v2 — button URL fixed.
UPDATE public.platform_wa_templates SET
  body_text = 'Hi {{1}} 👋,

🎉 Great news! Your order from *{{2}}* has shipped.

📦 Product: *{{3}}*
🚛 Courier: *{{4}}*
🔖 Tracking #: *{{5}}*
🗓️ Expected Delivery: *{{6}}*
💳 {{7}}

Tap below to track your shipment in real time. 📍',
  buttons = '[{"type":"URL","text":"Track Shipment","url":"https://shopbanao.in/r/{{1}}"}]'::jsonb,
  variables = ARRAY['customer_name','store_name','product_name','courier_name','tracking_number','expected_delivery','payment_status_line'],
  meta_status = NULL,
  meta_template_id = NULL,
  meta_rejected_reason = NULL,
  submitted_at = NULL,
  last_synced_at = NULL
WHERE name = 'order_shipped_v2';

-- 3) abandoned_cart_v2 — replace multi-line cart_items with item_count.
UPDATE public.platform_wa_templates SET
  body_text = 'Hi {{1}} 🛒,

💫 You left {{3}} item(s) in your cart at *{{2}}*.

💰 Total: *{{4}}*

⏳ Tap below to complete your order — it''s waiting for you!',
  buttons = '[{"type":"URL","text":"Resume Checkout","url":"https://shopbanao.in/r/{{1}}"}]'::jsonb,
  variables = ARRAY['customer_name','store_name','item_count','cart_total'],
  meta_status = NULL,
  meta_template_id = NULL,
  meta_rejected_reason = NULL,
  submitted_at = NULL,
  last_synced_at = NULL
WHERE name = 'abandoned_cart_v2';
