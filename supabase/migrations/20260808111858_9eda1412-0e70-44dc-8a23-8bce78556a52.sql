INSERT INTO public.platform_wa_templates
  (name, purpose, language, category, header_type, header_text, body_text, footer_text, variables, meta_status, is_active, buttons)
VALUES (
  'platform_alert_v1',
  'platform_alert',
  'en',
  'UTILITY',
  'TEXT',
  'ShopBanao system alert',
  'Alert: {{1}}' || chr(10) || 'Target: {{2}}' || chr(10) || 'Details: {{3}}' || chr(10) || 'Time: {{4}}',
  'Automated monitoring - ShopBanao',
  ARRAY['headline','target','details','time'],
  'DRAFT',
  true,
  '[]'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  body_text = EXCLUDED.body_text,
  header_text = EXCLUDED.header_text,
  footer_text = EXCLUDED.footer_text,
  variables = EXCLUDED.variables,
  category = EXCLUDED.category,
  is_active = true;