
ALTER TABLE public.platform_wa_templates
  ADD COLUMN IF NOT EXISTS footer_text TEXT,
  ADD COLUMN IF NOT EXISTS button_url_pattern TEXT;

-- Deactivate v1 so the queue stops picking them
UPDATE public.platform_wa_templates
   SET is_active = false, paused = true, pause_reason = 'superseded_by_v2'
 WHERE name IN ('order_confirmation_v1','order_shipped_v1','abandoned_cart_v1');

-- order_confirmation_v2 (UTILITY)
INSERT INTO public.platform_wa_templates
  (name, purpose, language, category, headline, body_preview, footer_text, button_label, button_url_pattern, variables, is_active, paused)
VALUES (
  'order_confirmation_v2',
  'Sent immediately after a new order is placed (online paid, partial-paid, or COD).',
  'en',
  'utility',
  'Order confirmed ✅',
  E'Hi {{1}}, thanks for ordering from {{2}}! 🎉\n\n🧾 Order #{{3}}\n💰 Total: {{4}}\n{{5}}\n📦 Expected delivery: by {{6}}\n\nWe''ll notify you the moment it ships.',
  'Powered by shopbanao.in',
  'Track order',
  '{{1}}',
  ARRAY['customer_name','store_name','order_number','order_total','payment_status_line','expected_delivery','order_link']::text[],
  true,
  false
)
ON CONFLICT (name) DO UPDATE
  SET purpose = EXCLUDED.purpose,
      category = EXCLUDED.category,
      headline = EXCLUDED.headline,
      body_preview = EXCLUDED.body_preview,
      footer_text = EXCLUDED.footer_text,
      button_label = EXCLUDED.button_label,
      button_url_pattern = EXCLUDED.button_url_pattern,
      variables = EXCLUDED.variables,
      is_active = true,
      paused = false,
      pause_reason = NULL,
      updated_at = now();

-- order_shipped_v2 (UTILITY)
INSERT INTO public.platform_wa_templates
  (name, purpose, language, category, headline, body_preview, footer_text, button_label, button_url_pattern, variables, is_active, paused)
VALUES (
  'order_shipped_v2',
  'Sent only when the merchant marks the order as shipped AND a tracking number is provided.',
  'en',
  'utility',
  'Your order is on the way 🚚',
  E'Hi {{1}}, your {{2}} order #{{3}} has been shipped! 🚚\n\n📮 Courier: {{4}}\n🔢 Tracking: {{5}}\n{{6}}\n🗓 Expected delivery: by {{7}}\n\nTap below to track in real time.',
  'Powered by shopbanao.in',
  'Track order',
  '{{1}}',
  ARRAY['customer_name','store_name','order_number','courier_name','tracking_number','payment_status_line','expected_delivery','tracking_url']::text[],
  true,
  false
)
ON CONFLICT (name) DO UPDATE
  SET purpose = EXCLUDED.purpose,
      category = EXCLUDED.category,
      headline = EXCLUDED.headline,
      body_preview = EXCLUDED.body_preview,
      footer_text = EXCLUDED.footer_text,
      button_label = EXCLUDED.button_label,
      button_url_pattern = EXCLUDED.button_url_pattern,
      variables = EXCLUDED.variables,
      is_active = true,
      paused = false,
      pause_reason = NULL,
      updated_at = now();

-- abandoned_cart_v2 (MARKETING)
INSERT INTO public.platform_wa_templates
  (name, purpose, language, category, headline, body_preview, footer_text, button_label, button_url_pattern, variables, is_active, paused)
VALUES (
  'abandoned_cart_v2',
  'Sent 1 hour after cart abandonment when the customer has marketing consent.',
  'en',
  'marketing',
  'You left something behind 🛒',
  E'Hi {{1}} 👋\n\nYou left items worth {{2}} in your cart at {{3}}.\n\nComplete your order now — fast delivery, easy returns.',
  'Reply STOP to unsubscribe · Powered by shopbanao.in',
  'Resume checkout',
  '{{1}}',
  ARRAY['customer_name','cart_total','store_name','checkout_url']::text[],
  true,
  false
)
ON CONFLICT (name) DO UPDATE
  SET purpose = EXCLUDED.purpose,
      category = EXCLUDED.category,
      headline = EXCLUDED.headline,
      body_preview = EXCLUDED.body_preview,
      footer_text = EXCLUDED.footer_text,
      button_label = EXCLUDED.button_label,
      button_url_pattern = EXCLUDED.button_url_pattern,
      variables = EXCLUDED.variables,
      is_active = true,
      paused = false,
      pause_reason = NULL,
      updated_at = now();
