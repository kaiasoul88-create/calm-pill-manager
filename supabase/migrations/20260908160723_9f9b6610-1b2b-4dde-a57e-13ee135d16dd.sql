-- lovable-cron-fallback-reviewed: 1440 runs/day; los recordatorios de medicamentos deben llegar a la hora exacta y dependen de la zona horaria de cada persona, no de un cambio en la base de datos, así que no hay evento que dispare el envío
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_config (key, value)
VALUES ('reminders_token', encode(extensions.gen_random_bytes(32), 'hex'));

SELECT cron.schedule(
  'pastillero-avisos',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := u,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.app_config WHERE key = 'reminders_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  FROM unnest(ARRAY[
    'https://project--acab05b3-2b0f-47da-977e-f09202d168ae.lovable.app/api/public/reminders/run',
    'https://project--acab05b3-2b0f-47da-977e-f09202d168ae-dev.lovable.app/api/public/reminders/run'
  ]) AS u;
  $$
);