
-- Refresh active WA templates with emoji-rich layouts. Drop order_number; use product_name instead.

UPDATE platform_wa_templates SET
  header_text = '✅ Order Confirmed',
  body_text = E'Hi {{1}} 👋,\n\n✅ Your order with *{{2}}* has been confirmed.\n\n📦 Product: *{{3}}*\n🛍️ Items: {{4}}\n💰 Total: *{{5}}*\n💳 {{6}}\n\n🚚 Expected Delivery: *{{7}}*\n\nThank you for shopping with us! 💗\nTap the button below to view your order.',
  footer_text = 'Powered by shopbanao.in',
  variables = ARRAY['customer_name','store_name','product_name','item_count','order_total','payment_status_line','expected_delivery']::text[],
  buttons = '[{"type":"URL","text":"View Order","url":"https://shopbanao.in/track/{{1}}"}]'::jsonb,
  is_active = true,
  updated_at = now()
WHERE name = 'order_confirmation_v2';

UPDATE platform_wa_templates SET
  header_text = '🚚 Your order is on the way',
  body_text = E'Hi {{1}} 👋,\n\n🎉 Great news! Your order from *{{2}}* has shipped.\n\n📦 Product: *{{3}}*\n🚛 Courier: *{{4}}*\n🔖 Tracking #: *{{5}}*\n🗓️ Expected Delivery: *{{6}}*\n💳 {{7}}\n\nTap below to track your shipment in real time. 📍',
  footer_text = 'Powered by shopbanao.in',
  variables = ARRAY['customer_name','store_name','product_name','courier_name','tracking_number','expected_delivery','payment_status_line']::text[],
  buttons = '[{"type":"URL","text":"Track Shipment","url":"https://shopbanao.in/track/{{1}}"}]'::jsonb,
  is_active = true,
  updated_at = now()
WHERE name = 'order_shipped_v2';

UPDATE platform_wa_templates SET
  header_text = '👋 You left something behind',
  body_text = E'Hi {{1}} 🛒,\n\n💫 You left these items in your cart at *{{2}}*:\n\n📦 {{3}}\n\n💰 Total: *{{4}}*\n\n⏳ Tap below to complete your order — it''s waiting for you!',
  footer_text = 'Reply STOP to unsubscribe · Powered by shopbanao.in',
  variables = ARRAY['customer_name','store_name','cart_items','cart_total']::text[],
  buttons = '[{"type":"URL","text":"Resume Checkout","url":"https://shopbanao.in/c/{{1}}"}]'::jsonb,
  is_active = true,
  updated_at = now()
WHERE name = 'abandoned_cart_v2';
