-- Template Studio: extend platform_wa_templates for the builder + submit flow.

ALTER TABLE public.platform_wa_templates
  ADD COLUMN IF NOT EXISTS header_type text DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS header_text text,
  ADD COLUMN IF NOT EXISTS body_text text,
  ADD COLUMN IF NOT EXISTS buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_rejected_reason text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Normalize category to Meta's enum (UTILITY/MARKETING/AUTHENTICATION).
UPDATE public.platform_wa_templates SET category = 'UTILITY'        WHERE lower(category) IN ('utility','transactional');
UPDATE public.platform_wa_templates SET category = 'MARKETING'      WHERE lower(category) = 'marketing';
UPDATE public.platform_wa_templates SET category = 'AUTHENTICATION' WHERE lower(category) IN ('authentication','auth','otp');

-- Backfill header_text/body_text/buttons for the 3 live templates so the new UI can render + submit them.
UPDATE public.platform_wa_templates SET
  header_type = 'TEXT',
  header_text = COALESCE(header_text, headline),
  body_text = COALESCE(body_text,
    'Hi {{1}}, your order with {{2}} is confirmed.' || E'\n\n' ||
    'Order: *{{3}}*' || E'\n' ||
    'Items: {{5}}' || E'\n' ||
    'Total: *{{4}}*' || E'\n' ||
    '{{6}}' || E'\n\n' ||
    'Expected delivery: *{{7}}*' || E'\n\n' ||
    'Thank you for shopping with us!'
  ),
  buttons = COALESCE(NULLIF(buttons, '[]'::jsonb),
    jsonb_build_array(jsonb_build_object('type','URL','text',COALESCE(button_label,'View Order'),'url',button_url_pattern))
  )
WHERE name = 'order_confirmation_v2';

UPDATE public.platform_wa_templates SET
  header_type = 'TEXT',
  header_text = COALESCE(header_text, headline),
  body_text = COALESCE(body_text,
    'Hi {{1}}, your order *{{3}}* from {{2}} has shipped! 🎉' || E'\n\n' ||
    'Courier: *{{4}}*' || E'\n' ||
    'Tracking #: *{{5}}*' || E'\n' ||
    'Expected delivery: *{{6}}*' || E'\n' ||
    '{{7}}' || E'\n\n' ||
    'Tap below to track in real time.'
  ),
  buttons = COALESCE(NULLIF(buttons, '[]'::jsonb),
    jsonb_build_array(jsonb_build_object('type','URL','text',COALESCE(button_label,'Track Shipment'),'url',button_url_pattern))
  )
WHERE name = 'order_shipped_v2';

UPDATE public.platform_wa_templates SET
  header_type = 'TEXT',
  header_text = COALESCE(header_text, headline),
  body_text = COALESCE(body_text,
    'Hi {{1}} 👋' || E'\n\n' ||
    'You left these items in your cart at *{{2}}*:' || E'\n\n' ||
    '{{3}}' || E'\n\n' ||
    'Total: *{{4}}*' || E'\n\n' ||
    'Tap below to complete your order — it''s waiting for you.'
  ),
  buttons = COALESCE(NULLIF(buttons, '[]'::jsonb),
    jsonb_build_array(jsonb_build_object('type','URL','text',COALESCE(button_label,'Resume Checkout'),'url',button_url_pattern))
  )
WHERE name = 'abandoned_cart_v2';

-- Lightweight audit table for template lifecycle events (separate from wa_health_log so we can show a per-template timeline cheaply).
CREATE TABLE IF NOT EXISTS public.wa_template_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  action text NOT NULL,             -- create | edit | delete | refresh | status_change
  actor uuid,
  meta_status text,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wa_template_audit TO authenticated;
GRANT ALL ON public.wa_template_audit TO service_role;

ALTER TABLE public.wa_template_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read template audit"
  ON public.wa_template_audit FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS wa_template_audit_name_created_idx
  ON public.wa_template_audit (template_name, created_at DESC);
