-- Lock read_email_batch to service_role only.
-- This function wraps pgmq.read() which POPS messages from a queue with a visibility timeout.
-- It was EXECUTE-able by PUBLIC, meaning any anon user could drain email queues
-- (password resets, OTPs, transactional mail) and hide messages from cron.
-- Cron uses service_role JWT which bypasses EXECUTE checks, so no caller breaks.

REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;