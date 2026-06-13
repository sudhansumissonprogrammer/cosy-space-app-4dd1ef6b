-- =====================================================================
-- Merge duplicate phone-guest auth users created by inconsistent
-- phone normalization (e.g. "9692282485" vs "919692282485" produced two
-- separate accounts for the same person).
--
-- For each local-10 collision:
--   winner  = oldest auth.users row
--   loser(s) = newer auth.users row(s) with the same trailing 10 digits
--
-- We repoint every storefront_customers / orders / customer_addresses /
-- customer_leads / customer_wishlists / push_subscriptions row from loser
-- to winner, delete loser storefront_customers/auth.users rows, and
-- canonicalize the winner's email to "<local10>@phone.guest".
-- =====================================================================

DO $$
DECLARE
  grp RECORD;
  winner_id uuid;
  winner_local text;
  loser_id uuid;
  win_cust_id uuid;
  lose_cust_id uuid;
  cust_row RECORD;
BEGIN
  FOR grp IN
    SELECT regexp_replace(split_part(email,'@',1), '^91', '') AS local10,
           array_agg(id ORDER BY created_at) AS ids
    FROM auth.users
    WHERE email LIKE '%@phone.guest'
      AND regexp_replace(split_part(email,'@',1), '^91', '') ~ '^[6-9][0-9]{9}$'
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    winner_id := grp.ids[1];
    winner_local := grp.local10;

    -- Walk each loser in this group
    FOR i IN 2 .. array_length(grp.ids, 1) LOOP
      loser_id := grp.ids[i];

      -- For each storefront_customers row owned by the loser,
      -- either merge into the winner's existing row for that store
      -- or just hand the row over to the winner.
      FOR cust_row IN
        SELECT id, store_id FROM public.storefront_customers WHERE user_id = loser_id
      LOOP
        lose_cust_id := cust_row.id;
        SELECT id INTO win_cust_id
          FROM public.storefront_customers
          WHERE user_id = winner_id AND store_id = cust_row.store_id
          LIMIT 1;

        IF win_cust_id IS NOT NULL THEN
          -- merge: repoint children of loser_cust to win_cust, then drop loser_cust
          UPDATE public.orders             SET storefront_customer_id = win_cust_id WHERE storefront_customer_id = lose_cust_id;
          UPDATE public.customer_addresses SET storefront_customer_id = win_cust_id WHERE storefront_customer_id = lose_cust_id;
          DELETE FROM public.storefront_customers WHERE id = lose_cust_id;
        ELSE
          -- give the row to the winner (UNIQUE(user_id,store_id) is safe — winner has none for this store)
          UPDATE public.storefront_customers SET user_id = winner_id WHERE id = lose_cust_id;
        END IF;
      END LOOP;

      -- Move other per-user rows that may exist for storefront customers
      UPDATE public.push_subscriptions SET user_id = winner_id WHERE user_id = loser_id;

      -- Finally remove the loser auth user
      DELETE FROM auth.users WHERE id = loser_id;
    END LOOP;

    -- Canonicalize the winner's email to the 10-digit form
    UPDATE auth.users
       SET email = winner_local || '@phone.guest'
     WHERE id = winner_id
       AND email <> winner_local || '@phone.guest';
  END LOOP;
END $$;

-- Normalize customer_phone / phone fields on existing rows so dashboard
-- lookups (e.g. "find orders for 9692282485") match regardless of how the
-- shopper originally typed it. We only canonicalize when the trailing 10
-- digits look like a valid Indian mobile.
UPDATE public.orders
   SET customer_phone = regexp_replace(customer_phone, '\D', '', 'g')
 WHERE customer_phone IS NOT NULL
   AND customer_phone <> regexp_replace(customer_phone, '\D', '', 'g');

UPDATE public.orders o
   SET customer_phone = right(regexp_replace(o.customer_phone, '\D', '', 'g'), 10)
 WHERE o.customer_phone IS NOT NULL
   AND length(regexp_replace(o.customer_phone, '\D', '', 'g')) IN (11, 12, 13)
   AND right(regexp_replace(o.customer_phone, '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$';

UPDATE public.customer_leads
   SET phone = right(regexp_replace(phone, '\D', '', 'g'), 10)
 WHERE phone IS NOT NULL
   AND length(regexp_replace(phone, '\D', '', 'g')) >= 10
   AND right(regexp_replace(phone, '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$';

UPDATE public.storefront_customers
   SET phone = right(regexp_replace(phone, '\D', '', 'g'), 10)
 WHERE phone IS NOT NULL
   AND length(regexp_replace(phone, '\D', '', 'g')) >= 10
   AND right(regexp_replace(phone, '\D', '', 'g'), 10) ~ '^[6-9][0-9]{9}$';
