
UPDATE public.platform_wa_templates
SET
  headline = '✅ Order Confirmed',
  body_preview = 'Hi *{{1}}*, thanks for ordering from *{{2}}*! 🙏

🧾 *Order #*{{3}}
💰 *Amount:* {{4}}
📦 *Items:* {{5}}

{{6}}

🚚 *Expected delivery by* {{7}}

We''ll notify you the moment it ships.',
  footer_text = 'Powered by shopbanao.in',
  button_label = 'View Order',
  button_url_pattern = 'https://shopbanao.in/track/{{1}}',
  variables = ARRAY['customer_name','store_name','order_number','order_total','item_count','payment_status_line','expected_delivery'],
  updated_at = now()
WHERE name = 'order_confirmation_v2';

UPDATE public.platform_wa_templates
SET
  headline = '🚚 Your order is on the way',
  body_preview = 'Hi *{{1}}*, your *{{2}}* order *#{{3}}* has been shipped! 📦

📮 *Courier:* {{4}}
🔢 *Tracking:* {{5}}
🗓 *Expected by* {{6}}

{{7}}

Tap below to track your shipment live.',
  footer_text = 'Powered by shopbanao.in',
  button_label = 'Track Shipment',
  button_url_pattern = 'https://shopbanao.in/track/{{1}}',
  variables = ARRAY['customer_name','store_name','order_number','courier_name','tracking_number','expected_delivery','payment_status_line'],
  updated_at = now()
WHERE name = 'order_shipped_v2';

UPDATE public.platform_wa_templates
SET
  headline = '👋 You left something behind',
  body_preview = 'Hi *{{1}}*, your cart at *{{2}}* is still waiting for you 🛍️

{{3}}

💰 *Cart total:* {{4}}

Complete your order now and enjoy *free shipping* on prepaid orders.',
  footer_text = 'Reply STOP to unsubscribe · Powered by shopbanao.in',
  button_label = 'Resume Checkout',
  button_url_pattern = 'https://shopbanao.in/c/{{1}}',
  variables = ARRAY['customer_name','store_name','cart_items','cart_total'],
  updated_at = now()
WHERE name = 'abandoned_cart_v2';
