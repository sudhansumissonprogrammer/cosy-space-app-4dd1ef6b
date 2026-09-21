DO $$
DECLARE
  test_user_id uuid := 'd4b0aa3e-7e6c-4e69-9ac6-8c1f5d4b0a21';
  test_store_id uuid := '7b15e1d4-f85e-43f8-b49d-53db8a0f729c';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = test_user_id) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', test_user_id,
      'authenticated', 'authenticated', 'pashupati-migration-demo@shopbanao.test',
      crypt('PashupatiDemo!2026-09', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Pashupati Migration Demo"}'::jsonb,
      now(), now(), '', '', '', ''
    );
  END IF;

  INSERT INTO public.stores (
    id, owner_id, name, slug, description, currency, order_mode,
    theme, owner_email, owner_name, meta_title, meta_description
  ) VALUES (
    test_store_id, test_user_id, 'Pashupati Migration Demo',
    'pashupati-migration-demo-qa', 'Disposable URL-import verification store',
    'INR', 'website', 'theme-16', 'pashupati-migration-demo@shopbanao.test',
    'Migration QA', 'Pashupati Migration Demo', 'Disposable migration test'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.store_theme_config (
    store_id, primary_color, accent_color, text_color, background_color,
    header_bg_color, header_text_color, heading_font, body_font,
    button_style, product_card_style, category_style, header_style,
    header_logo_alignment, mobile_nav_enabled, marquee_enabled, marquee_text,
    marquee_gradient
  ) VALUES (
    test_store_id, '#1a1a1a', '#f5f5f5', '#1a1a1a', '#ffffff',
    '#ffffff', '#1a1a1a', 'Alegreya SC', 'Alegreya SC',
    'rounded', 'style-1', 'style-1', 'normal', 'Left', true, false, '',
    'linear-gradient(90deg, #1a1a1a, #333333)'
  ) ON CONFLICT (store_id) DO NOTHING;
END
$$;