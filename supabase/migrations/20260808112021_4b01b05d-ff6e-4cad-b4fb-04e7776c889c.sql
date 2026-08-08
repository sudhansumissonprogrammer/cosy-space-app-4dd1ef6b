UPDATE public.platform_wa_templates
SET body_text = 'Automated monitoring has detected a change in your ShopBanao platform status. Please review the details below and take action if required.' || chr(10) || chr(10) ||
  'Status update: {{1}}' || chr(10) ||
  'Affected service or storefront: {{2}}' || chr(10) ||
  'Technical details from the last health check: {{3}}' || chr(10) ||
  'Detected at: {{4}}' || chr(10) || chr(10) ||
  'This message was sent automatically by the ShopBanao uptime monitor.',
  meta_status = 'DRAFT'
WHERE name = 'platform_alert_v1';