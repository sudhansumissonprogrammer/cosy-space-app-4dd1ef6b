
-- Refresh v2 template copy to match the attractive v1 mockup look:
-- prominent emoji headline as a TEXT header, generous spacing, bold key lines.
-- Headers use one variable max (Meta rule) → store_name for order templates,
-- customer_name for cart.

UPDATE public.platform_wa_templates
SET
  headline = '✅ Order Confirmed — {{1}}',
  body_preview = 'Hi *{{1}}*, thanks for your order! 🙏

🧾 *Order #*{{2}}
💰 *Amount:* {{3}}
📦 *Items:* {{4}}

{{5}}

🚚 *Expected delivery by* {{6}}

We''ll notify you the moment it ships.',
  footer_text = 'Powered by shopbanao.in',
  button_label = 'View Order',
  button_url_pattern = 'https://shopbanao.in/track/{{1}}',
  variables = ARRAY['customer_name','order_number','order_total','item_count','payment_status_line','expected_delivery','order_number_url'],
  updated_at = now()
WHERE name = 'order_confirmation_v2';

UPDATE public.platform_wa_templates
SET
  headline = '🚚 Your order is on the way — {{1}}',
  body_preview = 'Hi *{{1}}*, your order *#{{2}}* has been shipped! 📦

📮 *Courier:* {{3}}
🔢 *Tracking:* {{4}}
🗓 *Expected by* {{5}}

{{6}}

Tap below to track your shipment live.',
  footer_text = 'Powered by shopbanao.in',
  button_label = 'Track Shipment',
  button_url_pattern = 'https://shopbanao.in/track/{{1}}',
  variables = ARRAY['customer_name','order_number','courier_name','tracking_number','expected_delivery','payment_status_line','order_number_url'],
  updated_at = now()
WHERE name = 'order_shipped_v2';

UPDATE public.platform_wa_templates
SET
  headline = '👋 Hi {{1}}, you left something behind!',
  body_preview = 'Your cart at *{{1}}* is still waiting for you 🛍️

{{2}}

💰 *Cart total:* {{3}}

Complete your order now and enjoy *free shipping* on prepaid orders.',
  footer_text = 'Reply STOP to unsubscribe · Powered by shopbanao.in',
  button_label = 'Resume Checkout',
  button_url_pattern = 'https://shopbanao.in/c/{{1}}',
  variables = ARRAY['store_name','cart_items','cart_total','cart_token'],
  updated_at = now()
WHERE name = 'abandoned_cart_v2';
