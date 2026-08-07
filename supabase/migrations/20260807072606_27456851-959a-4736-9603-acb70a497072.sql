SELECT net.http_post(
  url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/wa-template-submit',
  headers := jsonb_build_object(
    'Content-Type','application/json',
    'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk',
    'x-cron-secret', (SELECT secret FROM public.cron_auth LIMIT 1)
  ),
  body := '{"action":"submit_pending","names":["order_shipped_v3","order_shipped_v3_img"]}'::jsonb
);