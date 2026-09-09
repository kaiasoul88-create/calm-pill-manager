CREATE POLICY "Service records push delivery attempts"
ON public.push_delivery_attempts FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service manages reminder send markers"
ON public.reminder_sends FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service manages internal app configuration"
ON public.app_config FOR ALL TO service_role
USING (true) WITH CHECK (true);