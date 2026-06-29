
-- 1) Conversation cost ledger
CREATE TABLE IF NOT EXISTS public.wa_conversation_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text,
  recipient_phone text NOT NULL,
  message_id text,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  category text,                      -- marketing | utility | authentication | service
  pricing_model text,                 -- CBP | PMP
  billable boolean DEFAULT true,
  cost numeric(12,4) DEFAULT 0,
  currency text DEFAULT 'INR',
  origin_type text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wa_conversation_costs TO authenticated;
GRANT ALL ON public.wa_conversation_costs TO service_role;
ALTER TABLE public.wa_conversation_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_costs_admin_read ON public.wa_conversation_costs;
CREATE POLICY wa_costs_admin_read ON public.wa_conversation_costs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS wa_conv_costs_conv_uniq
  ON public.wa_conversation_costs (conversation_id)
  WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS wa_conv_costs_created_at
  ON public.wa_conversation_costs (created_at DESC);
CREATE INDEX IF NOT EXISTS wa_conv_costs_store_id
  ON public.wa_conversation_costs (store_id);

-- 2) Cost summary RPC
CREATE OR REPLACE FUNCTION public.get_wa_cost_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_today jsonb;
  v_7d jsonb;
  v_mtd jsonb;
  v_by_cat jsonb;
BEGIN
  SELECT has_role(auth.uid(), 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'conversations', COUNT(*),
    'cost', COALESCE(SUM(cost),0),
    'currency', COALESCE(MAX(currency),'INR')
  ) INTO v_today
  FROM wa_conversation_costs WHERE created_at >= date_trunc('day', now());

  SELECT jsonb_build_object(
    'conversations', COUNT(*),
    'cost', COALESCE(SUM(cost),0)
  ) INTO v_7d
  FROM wa_conversation_costs WHERE created_at >= now() - interval '7 days';

  SELECT jsonb_build_object(
    'conversations', COUNT(*),
    'cost', COALESCE(SUM(cost),0)
  ) INTO v_mtd
  FROM wa_conversation_costs WHERE created_at >= date_trunc('month', now());

  SELECT COALESCE(jsonb_object_agg(category, payload), '{}'::jsonb) INTO v_by_cat FROM (
    SELECT
      COALESCE(category,'unknown') AS category,
      jsonb_build_object('conversations', COUNT(*), 'cost', COALESCE(SUM(cost),0)) AS payload
    FROM wa_conversation_costs
    WHERE created_at >= date_trunc('month', now())
    GROUP BY 1
  ) s;

  RETURN jsonb_build_object(
    'today', v_today,
    'last_7d', v_7d,
    'mtd', v_mtd,
    'by_category_mtd', v_by_cat
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_wa_cost_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wa_cost_summary() TO authenticated;

-- 3) Campaign pre-check RPC (recipient/opt-out/tier/spam audit before send)
CREATE OR REPLACE FUNCTION public.wa_campaign_precheck(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_camp record;
  v_tpl record;
  v_audience int := 0;
  v_optouts int := 0;
  v_sent_24h int := 0;
  v_tier_limit int;
  v_remaining int;
  v_warnings jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_link_count int := 0;
  v_caps_ratio numeric := 0;
  v_body text;
BEGIN
  SELECT has_role(auth.uid(),'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_camp FROM platform_wa_campaigns WHERE id = _campaign_id;
  IF v_camp IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;

  SELECT * INTO v_tpl FROM platform_wa_templates WHERE name = v_camp.template_name LIMIT 1;
  IF v_tpl IS NULL THEN
    v_errors := v_errors || jsonb_build_array('template_missing');
  ELSIF COALESCE(v_tpl.is_active,false) = false THEN
    v_errors := v_errors || jsonb_build_array('template_inactive');
  ELSIF v_tpl.meta_status IS NOT NULL AND lower(v_tpl.meta_status) <> 'approved' THEN
    v_errors := v_errors || jsonb_build_array('template_not_approved:' || v_tpl.meta_status);
  END IF;

  BEGIN
    SELECT COUNT(*) INTO v_audience FROM expand_campaign_audience(COALESCE(v_camp.audience_filter,'{}'::jsonb));
  EXCEPTION WHEN OTHERS THEN
    v_audience := 0;
    v_warnings := v_warnings || jsonb_build_array('audience_expand_failed');
  END;

  SELECT COUNT(*) INTO v_optouts FROM whatsapp_optouts;

  SELECT COUNT(*) INTO v_sent_24h
  FROM whatsapp_messages
  WHERE sent_via='platform' AND direction='outgoing'
    AND created_at >= now() - interval '24 hours';

  SELECT COALESCE((wa_tier_limit), 250) INTO v_tier_limit FROM platform_config LIMIT 1;
  v_remaining := GREATEST(v_tier_limit - v_sent_24h, 0);

  IF v_audience = 0 THEN
    v_errors := v_errors || jsonb_build_array('empty_audience');
  END IF;
  IF v_audience > v_remaining THEN
    v_warnings := v_warnings || jsonb_build_array('exceeds_tier_capacity');
  END IF;

  -- spam audit on template body
  IF v_tpl.body IS NOT NULL THEN
    v_body := v_tpl.body;
    v_link_count := (length(v_body) - length(replace(lower(v_body),'http','')))/4;
    IF length(regexp_replace(v_body,'[^A-Z]','','g')) > 0 THEN
      v_caps_ratio := length(regexp_replace(v_body,'[^A-Z]','','g'))::numeric
                      / GREATEST(length(regexp_replace(v_body,'[^A-Za-z]','','g')),1);
    END IF;
    IF v_link_count > 2 THEN
      v_warnings := v_warnings || jsonb_build_array('too_many_links');
    END IF;
    IF v_caps_ratio > 0.6 AND length(v_body) > 40 THEN
      v_warnings := v_warnings || jsonb_build_array('high_caps_ratio');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'audience', v_audience,
    'opt_outs', v_optouts,
    'sent_24h', v_sent_24h,
    'tier_limit', v_tier_limit,
    'remaining_today', v_remaining,
    'link_count', v_link_count,
    'caps_ratio', v_caps_ratio,
    'errors', v_errors,
    'warnings', v_warnings,
    'can_send', (jsonb_array_length(v_errors) = 0 AND v_audience > 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.wa_campaign_precheck(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wa_campaign_precheck(uuid) TO authenticated;
