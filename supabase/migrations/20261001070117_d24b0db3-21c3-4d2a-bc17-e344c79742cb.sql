UPDATE public.products SET is_active = true WHERE store_id='0b03144b-9d6a-47ce-82b8-f2cbc850c3ec';
UPDATE public.categories SET is_hidden = false, show_on_home = true WHERE store_id='0b03144b-9d6a-47ce-82b8-f2cbc850c3ec';
UPDATE public.store_pages SET is_active = true WHERE store_id='0b03144b-9d6a-47ce-82b8-f2cbc850c3ec';
UPDATE public.stores SET logo_url = NULL WHERE id='0b03144b-9d6a-47ce-82b8-f2cbc850c3ec';