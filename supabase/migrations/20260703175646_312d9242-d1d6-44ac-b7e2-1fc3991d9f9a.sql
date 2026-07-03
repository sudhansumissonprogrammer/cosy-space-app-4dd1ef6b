UPDATE public.platform_wa_templates SET
  body_text = E'Hi {{1}} 🛒,\n\nYou left *{{2}}* in your cart at *{{3}}*.\n\n💰 Total: *{{4}}*\n\n⏳ Tap below to complete your order — it''s waiting for you!',
  body_preview = E'Hi *{{1}}*, you left *{{2}}* in your cart at *{{3}}*.\n\n💰 *Cart total:* {{4}}\n\nComplete your order now and enjoy *free shipping* on prepaid orders.',
  variables = ARRAY['customer_name','product_title','store_name','cart_total','cta_token'],
  updated_at = now()
WHERE name = 'abandoned_cart_v2';