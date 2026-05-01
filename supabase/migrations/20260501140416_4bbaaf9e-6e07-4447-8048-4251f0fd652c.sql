DELETE FROM public.page_views
WHERE path LIKE '/~api/%'
   OR path LIKE '/api/%'
   OR path LIKE '/cf-img%'
   OR path LIKE '/\_%' ESCAPE '\'
   OR path ~* '\.(js|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|json|xml|txt)(\?|$)';