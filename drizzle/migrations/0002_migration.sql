insert into public.platform_wa_templates (
  name, language, category, purpose, header_type, header_text,
  body_text, footer_text, buttons, variables, headline,
  is_active, paused, meta_status
) values (
  'cod_order_confirm_v2',
  'en',
  'UTILITY',
  'utility',
  'TEXT',
  'Order Confirmation Request',
  'Hello {{1}},

We have received your order at {{2}}.

Before processing, please review and confirm the details:

*Order Summary*
• Order ID: {{3}}
• Items: {{4}}
• Quantity: {{5}}
• Total Amount: {{6}}
• Payment Method: Cash on Delivery

Please choose an option below to continue.',
  null,
  '[{"type":"QUICK_REPLY","text":"Confirm My Order"},{"type":"QUICK_REPLY","text":"Cancel My Order"}]'::jsonb,
  array['customer_name','store_name','order_number','product_name','item_count','order_total'],
  'COD order confirmation (v2, JD-style)',
  false,
  false,
  'DRAFT'
)
on conflict (name) do nothing;