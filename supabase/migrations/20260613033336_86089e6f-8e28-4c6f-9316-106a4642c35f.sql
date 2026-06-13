-- =====================================================================
-- Pass 1 (re-run, correctly): merge auth users by TRAILING 10 digits.
-- Previous attempt stripped a leading "^91" which incorrectly chopped
-- real 10-digit numbers that happen to start with 91 (e.g. 9111312317).
-- =====================================================================
DO $$
DECLARE
  grp RECORD;
  winner_id uuid;
  loser_id uuid;
  cust_row RECORD;
  win_cust_id uuid;
BEGIN
  FOR grp IN
    SELECT right(split_part(email,'@',1), 10) AS l10,
           array_agg(id ORDER BY created_at) AS ids
    FROM auth.users
    WHERE email LIKE '%@phone.guest'
      AND right(split_part(email,'@',1), 10) ~ '^[6-9][0-9]{9}$'
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    winner_id := grp.ids[1];
    FOR i IN 2 .. array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];

      FOR cust_row IN
        SELECT id, store_id FROM public.storefront_customers WHERE user_id = loser_id
      LOOP
        SELECT id INTO win_cust_id
          FROM public.storefront_customers
          WHERE user_id = winner_id AND store_id = cust_row.store_id
          LIMIT 1;

        IF win_cust_id IS NOT NULL THEN
          UPDATE public.orders             SET storefront_customer_id = win_cust_id WHERE storefront_customer_id = cust_row.id;
          UPDATE public.customer_addresses SET storefront_customer_id = win_cust_id WHERE storefront_customer_id = cust_row.id;
          DELETE FROM public.storefront_customers WHERE id = cust_row.id;
        ELSE
          UPDATE public.storefront_customers SET user_id = winner_id WHERE id = cust_row.id;
        END IF;
      END LOOP;

      UPDATE public.push_subscriptions SET user_id = winner_id WHERE user_id = loser_id;
      DELETE FROM auth.users WHERE id = loser_id;
    END LOOP;

    UPDATE auth.users
       SET email = grp.l10 || '@phone.guest'
     WHERE id = winner_id
       AND email <> grp.l10 || '@phone.guest';
  END LOOP;
END $$;

-- =====================================================================
-- Pass 2: canonicalize the 1,734 SINGLETON 12-digit emails to 10-digit.
-- Pass 1 already merged any (12-digit, 10-digit) pair, so the 10-digit
-- target slot is now guaranteed free for every remaining 12-digit row.
-- =====================================================================
UPDATE auth.users
   SET email = right(split_part(email,'@',1), 10) || '@phone.guest'
 WHERE email LIKE '%@phone.guest'
   AND right(split_part(email,'@',1), 10) ~ '^[6-9][0-9]{9}$'
   AND email <> right(split_part(email,'@',1), 10) || '@phone.guest';

-- =====================================================================
-- Defense-in-depth: hard unique constraint on (store_id, phone).
-- Multiple NULLs are allowed (Postgres default), which we want — guest
-- placeholder rows without a phone shouldn't collide.
-- =====================================================================
CREATE UNIQUE INDEX IF NOT EXISTS storefront_customers_store_phone_uniq
  ON public.storefront_customers (store_id, phone)
  WHERE phone IS NOT NULL;

-- =====================================================================
-- Weekly verifier: scans for any regression and logs to error_logs.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.verify_phone_account_integrity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bad_auth_count int;
  dup_cust_count int;
  bad_phone_count int;
  details text;
BEGIN
  SELECT count(*) INTO bad_auth_count
    FROM auth.users
   WHERE email LIKE '%@phone.guest'
     AND split_part(email,'@',1) !~ '^[6-9][0-9]{9}$';

  SELECT count(*) INTO dup_cust_count
    FROM (
      SELECT store_id, phone FROM public.storefront_customers
      WHERE phone IS NOT NULL
      GROUP BY 1,2 HAVING count(*) > 1
    ) x;

  SELECT count(*) INTO bad_phone_count
    FROM public.storefront_customers
   WHERE phone IS NOT NULL
     AND phone !~ '^[6-9][0-9]{9}$';

  IF bad_auth_count > 0 OR dup_cust_count > 0 OR bad_phone_count > 0 THEN
    details := format(
      'phone-account integrity regression: %s non-canonical auth users, %s (store,phone) duplicates, %s malformed storefront_customers.phone',
      bad_auth_count, dup_cust_count, bad_phone_count
    );

    INSERT INTO public.error_logs (level, source, message, context, created_at)
    VALUES (
      'critical',
      'verify_phone_account_integrity',
      details,
      jsonb_build_object(
        'bad_auth_count',  bad_auth_count,
        'dup_cust_count',  dup_cust_count,
        'bad_phone_count', bad_phone_count
      ),
      now()
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_phone_account_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_phone_account_integrity() TO service_role;

-- Weekly schedule (Mondays 03:30 UTC). pg_cron is already enabled.
DO $$ BEGIN
  PERFORM cron.unschedule('verify-phone-account-integrity');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'verify-phone-account-integrity',
  '30 3 * * 1',
  $cron$ SELECT public.verify_phone_account_integrity(); $cron$
);
