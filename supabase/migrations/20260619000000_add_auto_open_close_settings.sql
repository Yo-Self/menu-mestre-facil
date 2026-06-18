-- Auto open/close restaurant based on configured business hours
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS auto_open_close_by_schedule boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.auto_open_close_by_schedule IS
  'When true, automatically opens/closes the restaurant based on restaurant_hours schedule.';

-- Auto open/close restaurant when POS cash register session opens/closes
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS auto_open_close_by_pos boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.auto_open_close_by_pos IS
  'When true, automatically opens the restaurant when a POS session opens and closes it when the session closes.';
