UPDATE public.platform_wa_templates SET
  body_text = E'Hi {{1}} 👋,\n\nYou were checking out *{{2}}* at *{{3}}*.\n\n💰 Price: *{{4}}*\n\n⏳ It''s still available — tap below to complete your purchase before it''s gone!',
  body_preview = E'Hi *{{1}}*, you were viewing *{{2}}* at *{{3}}*.\n\n💰 *Price:* {{4}}\n\nTap below to complete your purchase — free shipping on prepaid orders.',
  variables = ARRAY['customer_name','product_title','store_name','product_price','cta_token'],
  button_label = 'Complete Purchase',
  buttons = '[{"type":"URL","text":"Complete Purchase","url":"https://shopbanao.in/r/{{5}}"}]'::jsonb,
  updated_at = now()
WHERE name = 'abandoned_cart_v2';