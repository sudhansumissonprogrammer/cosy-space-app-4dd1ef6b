
-- 1. Template grouping + category-change appeal fields
ALTER TABLE public.platform_wa_templates
  ADD COLUMN IF NOT EXISTS template_group text,
  ADD COLUMN IF NOT EXISTS category_change_to text,
  ADD COLUMN IF NOT EXISTS category_change_reason text,
  ADD COLUMN IF NOT EXISTS category_change_requested_at timestamptz;

UPDATE public.platform_wa_templates SET template_group = name WHERE template_group IS NULL;

CREATE INDEX IF NOT EXISTS idx_pwt_group_lang
  ON public.platform_wa_templates(template_group, language)
  WHERE is_active = true;

-- 2. Per-recipient locale on queue
ALTER TABLE public.wa_send_queue
  ADD COLUMN IF NOT EXISTS recipient_timezone text,
  ADD COLUMN IF NOT EXISTS recipient_locale text,
  ADD COLUMN IF NOT EXISTS ab_variant text;

-- 3. A/B + scheduling additions on campaigns
ALTER TABLE public.platform_wa_campaigns
  ADD COLUMN IF NOT EXISTS ab_variant_template text,
  ADD COLUMN IF NOT EXISTS ab_split_pct int DEFAULT 50 CHECK (ab_split_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS respect_recipient_tz boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start int DEFAULT 9 CHECK (quiet_hours_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS quiet_hours_end int DEFAULT 21 CHECK (quiet_hours_end BETWEEN 0 AND 23);

-- 4. Clone template
CREATE OR REPLACE FUNCTION public.wa_clone_template(_id uuid, _new_name text, _new_language text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_src public.platform_wa_templates;
  v_new_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_src FROM public.platform_wa_templates WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF _new_name IS NULL OR length(trim(_new_name)) = 0 THEN RAISE EXCEPTION 'name_required'; END IF;
  IF EXISTS (SELECT 1 FROM public.platform_wa_templates WHERE name = _new_name) THEN
    RAISE EXCEPTION 'name_exists';
  END IF;
  INSERT INTO public.platform_wa_templates (
    name, purpose, language, body_preview, variables, is_active, category,
    button_label, headline, footer_text, button_url_pattern, header_type,
    header_text, body_text, buttons, header_media_url, template_group, meta_status
  ) VALUES (
    _new_name, v_src.purpose, COALESCE(NULLIF(_new_language,''), v_src.language), v_src.body_preview,
    v_src.variables, true, v_src.category, v_src.button_label, v_src.headline,
    v_src.footer_text, v_src.button_url_pattern, v_src.header_type, v_src.header_text,
    v_src.body_text, v_src.buttons, v_src.header_media_url,
    COALESCE(v_src.template_group, v_src.name), 'draft'
  ) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

-- 5. Request a Meta category change
CREATE OR REPLACE FUNCTION public.wa_request_category_change(_id uuid, _category text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _category NOT IN ('UTILITY','MARKETING','AUTHENTICATION') THEN RAISE EXCEPTION 'bad_category'; END IF;
  UPDATE public.platform_wa_templates
    SET category_change_to = _category,
        category_change_reason = _reason,
        category_change_requested_at = now(),
        updated_at = now()
   WHERE id = _id;
END;
$$;

-- 6. Template performance over a window
CREATE OR REPLACE FUNCTION public.wa_template_perf(_template_name text, _days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since timestamptz := now() - make_interval(days => GREATEST(_days,1));
  v_sent int; v_delivered int; v_read int; v_clicked int; v_optouts int; v_failed int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT
    count(*) FILTER (WHERE status IN ('sent','delivered','read')),
    count(*) FILTER (WHERE status IN ('delivered','read')),
    count(*) FILTER (WHERE status = 'read'),
    count(*) FILTER (WHERE status = 'failed')
  INTO v_sent, v_delivered, v_read, v_failed
  FROM public.whatsapp_messages
  WHERE template_name = _template_name
    AND sent_via = 'platform'
    AND direction = 'outgoing'
    AND created_at >= v_since;

  SELECT count(*) INTO v_clicked
  FROM public.wa_link_clicks c
  JOIN public.whatsapp_messages m ON m.meta_message_id = c.message_id
  WHERE m.template_name = _template_name AND c.clicked_at >= v_since;

  SELECT count(*) INTO v_optouts
  FROM public.whatsapp_optouts
  WHERE opted_out_at >= v_since;

  RETURN jsonb_build_object(
    'sent', v_sent, 'delivered', v_delivered, 'read', v_read,
    'failed', v_failed, 'clicked', v_clicked, 'optouts', v_optouts,
    'delivery_rate', CASE WHEN v_sent>0 THEN round(v_delivered::numeric/v_sent*100,2) ELSE 0 END,
    'read_rate', CASE WHEN v_delivered>0 THEN round(v_read::numeric/v_delivered*100,2) ELSE 0 END,
    'ctr', CASE WHEN v_read>0 THEN round(v_clicked::numeric/v_read*100,2) ELSE 0 END,
    'optout_rate_window', v_optouts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_clone_template(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wa_request_category_change(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wa_template_perf(text, int) TO authenticated;
