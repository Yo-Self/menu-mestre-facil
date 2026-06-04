-- InfinitePay PIX checkout (opt-in per restaurant; defaults keep production unchanged)

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS infinitepay_handle text,
  ADD COLUMN IF NOT EXISTS pix_payment_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.infinitepay_handle IS
  'InfinitePay InfiniteTag (without $). Required when pix_payment_enabled is true.';
COMMENT ON COLUMN public.restaurants.pix_payment_enabled IS
  'When true, shows PIX checkout button on digital menu. Default false.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS infinitepay_invoice_slug text,
  ADD COLUMN IF NOT EXISTS infinitepay_transaction_nsu text,
  ADD COLUMN IF NOT EXISTS payment_provider text;

COMMENT ON COLUMN public.orders.payment_provider IS
  'Payment gateway used for this order: stripe | infinitepay';

CREATE TABLE IF NOT EXISTS public.infinitepay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  order_nsu text NOT NULL,
  transaction_nsu text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.infinitepay_webhook_events IS
  'Idempotency for InfinitePay webhook notifications.';

ALTER TABLE public.infinitepay_webhook_events ENABLE ROW LEVEL SECURITY;
