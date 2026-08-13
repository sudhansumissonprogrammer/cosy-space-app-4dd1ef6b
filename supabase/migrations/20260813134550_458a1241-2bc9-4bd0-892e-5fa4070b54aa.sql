insert into public.stores (owner_id, owner_email, name, slug, description, currency, theme, order_mode, whatsapp_number, checkout_v2_enabled, billing_mode, timezone, city, state, features)
values (
  '218c8e58-43ca-434e-8b1c-52a31e30c9a1',
  'sudhansusahoo7411@gmail.com',
  'Watch Trade',
  'watchtrade',
  'Premium luxury watch collection — Rolex, Omega, Cartier, Patek Philippe and more, with 1 year warranty, 8 days return and COD available.',
  'INR',
  'theme-16',
  'website',
  '9692282485',
  true,
  'commission',
  'Asia/Kolkata',
  'Bhubaneswar',
  'Odisha',
  '[{"icon":"Award","title":"Premium Quality","description":"Finest materials and finishing"},{"icon":"Shield","title":"1 Year Warranty","description":"Warranty on every timepiece"},{"icon":"RefreshCw","title":"8 Days Return","description":"Easy returns within 8 days"},{"icon":"Truck","title":"COD Available","description":"Cash on delivery across India"}]'::jsonb
)
on conflict (slug) do nothing;