UPDATE public.stores AS s SET logo_url = v.new_url, updated_at = now()
FROM (VALUES
 ('nayakstore','https://cdn.shopbanao.in/store-logos/ea669bd1-367a-4398-861e-6a50c36b05a8/splash/7757844414-384w.webp'),
 ('maviratraimitation','https://cdn.shopbanao.in/store-logos/ac196d33-f481-4471-936f-058dde9851f2/splash/3380024097-384w.webp'),
 ('krishnajewels','https://cdn.shopbanao.in/store-logos/6d38345b-5a49-4991-a771-5d4c20a9e29e/splash/7874555489-384w.webp'),
 ('overlays','https://cdn.shopbanao.in/store-logos/b2a1c3d4-e5f6-7890-abcd-ef1234567890/splash/6176117750-384w.webp'),
 ('earpodsin','https://cdn.shopbanao.in/store-logos/ff02a639-99ef-4b2d-bbc2-4ff5cea9d639/splash/1582672017-384w.webp'),
 ('watchtrade','https://cdn.shopbanao.in/store-logos/374f9121-5506-4bc7-a435-1b4b5af78a1f/splash/4944427532-384w.webp'),
 ('nayak-store','https://cdn.shopbanao.in/store-logos/76a43b11-50fe-4a80-b265-333f453fa6ae/splash/7445570842-384w.webp'),
 ('ashishnaturals','https://cdn.shopbanao.in/store-logos/d5006a21-bc1d-4e05-bfc9-a710bed4ede5/splash/4873285363-384w.webp'),
 ('hopknock','https://cdn.shopbanao.in/store-logos/d07b0784-4103-494e-b243-8fcbdf5fd473/splash/7404700705-384w.webp'),
 ('serdiyajewels','https://cdn.shopbanao.in/store-logos/04010cad-1cbe-40ac-b818-07d9a79c1bf7/splash/7751432811-384w.webp'),
 ('stylebazaar','https://cdn.shopbanao.in/store-logos/a1b2c3d4-e5f6-7890-abcd-ef1234567890/splash/8791371189-384w.webp'),
 ('kashmirihandicrafts','https://cdn.shopbanao.in/store-logos/b2c24f2b-ad3f-4e0d-942f-a221075aebba/splash/2743728549-384w.webp'),
 ('utkalwatches','https://cdn.shopbanao.in/store-logos/ab19143d-87a9-490e-90b7-837313522782/splash/5568999811-384w.webp'),
 ('dd','https://cdn.shopbanao.in/store-logos/3abfae73-dc01-40dd-9f3e-6aee18e954cd/splash/4790297831-384w.webp')
) AS v(slug, new_url)
WHERE s.slug = v.slug;