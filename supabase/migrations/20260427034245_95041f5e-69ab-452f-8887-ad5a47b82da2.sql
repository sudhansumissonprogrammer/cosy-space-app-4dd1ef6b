UPDATE store_plan_assignments
SET billing_status='active',
    current_period_end='2026-05-05 00:00:00+00',
    last_payment_at=now(),
    grace_period_ends_at=NULL,
    next_billing_amount=NULL,
    updated_at=now()
WHERE store_id='771a3012-393c-421a-b1c9-2ca918e6917f';