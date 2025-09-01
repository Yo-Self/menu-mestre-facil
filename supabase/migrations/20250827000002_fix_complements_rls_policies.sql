-- Migration: Restore complements RLS policies to allow restaurant owners to manage complements
-- Context: Previous migration dropped complements policies when introducing shared complement groups
-- Goal: Ensure owners can SELECT/INSERT/UPDATE/DELETE complements for their restaurants

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE public.complements ENABLE ROW LEVEL SECURITY;

-- Drop possibly conflicting policies if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'complements' AND policyname = 'Users can view own restaurant complements'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view own restaurant complements" ON public.complements';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'complements' AND policyname = 'Users can insert own restaurant complements'
  ) THEN
    EXECUTE 'DROP POLICY "Users can insert own restaurant complements" ON public.complements';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'complements' AND policyname = 'Users can update own restaurant complements'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own restaurant complements" ON public.complements';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'complements' AND policyname = 'Users can delete own restaurant complements'
  ) THEN
    EXECUTE 'DROP POLICY "Users can delete own restaurant complements" ON public.complements';
  END IF;
END$$;

-- Policy: SELECT complements for own restaurants
CREATE POLICY "Users can view own restaurant complements"
ON public.complements FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.complement_groups cg
    JOIN public.restaurants r ON r.id = cg.restaurant_id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
);

-- Policy: INSERT complements for own restaurants
CREATE POLICY "Users can insert own restaurant complements"
ON public.complements FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.complement_groups cg
    JOIN public.restaurants r ON r.id = cg.restaurant_id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
);

-- Policy: UPDATE complements for own restaurants
CREATE POLICY "Users can update own restaurant complements"
ON public.complements FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.complement_groups cg
    JOIN public.restaurants r ON r.id = cg.restaurant_id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.complement_groups cg
    JOIN public.restaurants r ON r.id = cg.restaurant_id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
);

-- Policy: DELETE complements for own restaurants
CREATE POLICY "Users can delete own restaurant complements"
ON public.complements FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.complement_groups cg
    JOIN public.restaurants r ON r.id = cg.restaurant_id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
);

COMMIT;


