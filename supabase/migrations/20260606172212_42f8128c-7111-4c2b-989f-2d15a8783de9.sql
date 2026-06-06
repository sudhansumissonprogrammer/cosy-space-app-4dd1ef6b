UPDATE public.store_pages
SET custom_html = NULL,
    updated_at = now()
WHERE page_type IN ('about', 'about_us', 'contact')
  AND custom_html IS NOT NULL;