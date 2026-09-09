ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS expiration_time timestamptz,
  ADD COLUMN IF NOT EXISTS service_worker_scope text;

CREATE TABLE public.push_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES public.medications(id) ON DELETE SET NULL,
  push_subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
  kind text NOT NULL,
  http_status integer NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_delivery_attempts TO service_role;
ALTER TABLE public.push_delivery_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX push_delivery_attempts_user_time_idx
  ON public.push_delivery_attempts (user_id, attempted_at DESC);