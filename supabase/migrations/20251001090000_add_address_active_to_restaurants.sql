-- Add address_active flag to restaurants and enforce address present when active
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS address_active boolean NOT NULL DEFAULT false;

-- Ensure it can only be true when address is filled (non-null and non-empty)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurants_address_active_requires_address'
  ) THEN
    ALTER TABLE public.restaurants
    ADD CONSTRAINT restaurants_address_active_requires_address
    CHECK (
      address_active = false OR (address IS NOT NULL AND length(trim(address)) > 0)
    );
  END IF;
END $$;


