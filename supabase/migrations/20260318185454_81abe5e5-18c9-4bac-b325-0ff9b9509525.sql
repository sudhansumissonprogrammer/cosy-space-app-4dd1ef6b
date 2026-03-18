
-- Allow service_role to delete old page_views
CREATE POLICY "Service role can delete page views"
ON public.page_views
FOR DELETE
TO public
USING (auth.role() = 'service_role');

-- Allow service_role to delete old abandoned_carts
CREATE POLICY "Service role can delete abandoned carts"
ON public.abandoned_carts
FOR DELETE
TO public
USING (auth.role() = 'service_role');

-- Allow service_role to delete old email_send_log
CREATE POLICY "Service role can delete email send log"
ON public.email_send_log
FOR DELETE
TO public
USING (auth.role() = 'service_role');

-- Allow service_role to delete old whatsapp_messages
CREATE POLICY "Service role can delete whatsapp messages"
ON public.whatsapp_messages
FOR DELETE
TO public
USING (auth.role() = 'service_role');
