-- Migration: cleanup_duplicate_policies
-- Description: Clean up duplicate policies and add missing security features

-- 1. Remove duplicate policies
DROP POLICY IF EXISTS "Permitir leitura pública para categorias" ON public.categories;
DROP POLICY IF EXISTS "Permitir leitura pública para pratos" ON public.dishes;
DROP POLICY IF EXISTS "Permitir leitura pública para restaurantes" ON public.restaurants;

-- 2. Fix dish_categories policies to be more secure
DROP POLICY IF EXISTS "Allow authenticated users to manage dish_categories" ON public.dish_categories;
DROP POLICY IF EXISTS "Allow public read access to dish_categories" ON public.dish_categories;

CREATE POLICY "Restaurant owners can manage dish categories"
ON public.dish_categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.dishes d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_categories.dish_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.dishes d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE d.id = dish_categories.dish_id
      AND r.user_id = auth.uid()
  )
);

-- 3. Add missing policies for profiles table (INSERT policy)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 4. Add data validation constraints
ALTER TABLE public.restaurants 
ADD CONSTRAINT check_restaurant_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

ALTER TABLE public.dishes 
ADD CONSTRAINT check_dish_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

ALTER TABLE public.categories 
ADD CONSTRAINT check_category_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 50);

-- 5. Add URL validation constraints (only if they don't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_valid_image_url' 
    AND conrelid = 'public.restaurants'::regclass
  ) THEN
    ALTER TABLE public.restaurants 
    ADD CONSTRAINT check_valid_image_url 
    CHECK (image_url IS NULL OR image_url ~ '^https?://');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_valid_dish_image_url' 
    AND conrelid = 'public.dishes'::regclass
  ) THEN
    ALTER TABLE public.dishes 
    ADD CONSTRAINT check_valid_dish_image_url 
    CHECK (image_url IS NULL OR image_url ~ '^https?://');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_valid_category_image_url' 
    AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories 
    ADD CONSTRAINT check_valid_category_image_url 
    CHECK (image_url IS NULL OR image_url ~ '^https?://');
  END IF;
END $$;

-- 6. Add phone number validation for WhatsApp (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_valid_whatsapp_phone' 
    AND conrelid = 'public.restaurants'::regclass
  ) THEN
    ALTER TABLE public.restaurants 
    ADD CONSTRAINT check_valid_whatsapp_phone 
    CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^\+[1-9]\d{1,14}$');
  END IF;
END $$;

-- 7. Ensure all foreign key relationships are properly indexed for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON public.restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON public.dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON public.dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_menus_restaurant_id ON public.menus(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_id ON public.waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_attended_by ON public.waiter_calls(attended_by);

-- 8. Create audit trail table for sensitive operations
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid,
  user_id uuid REFERENCES auth.users(id),
  old_values jsonb,
  new_values jsonb,
  timestamp timestamptz DEFAULT now(),
  ip_address inet,
  user_agent text
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own audit entries
CREATE POLICY "Users can view their own audit entries"
ON public.audit_log
FOR SELECT
USING (user_id = auth.uid());

-- 9. Create function to log audit entries
CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_table_name text,
  p_operation text,
  p_record_id uuid,
  p_old_values jsonb DEFAULT NULL,
  p_new_values jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name,
    operation,
    record_id,
    user_id,
    old_values,
    new_values
  ) VALUES (
    p_table_name,
    p_operation,
    p_record_id,
    auth.uid(),
    p_old_values,
    p_new_values
  );
END;
$$;

-- 10. Add security comments
COMMENT ON TABLE public.audit_log IS 'Security: Audit trail for sensitive operations';
COMMENT ON FUNCTION public.log_audit_entry(text, text, uuid, jsonb, jsonb) IS 'Security: Function to log audit entries with definer privileges';

-- 11. Add security comments to existing tables
COMMENT ON TABLE public.restaurants IS 'Security: RLS enabled with user ownership policies';
COMMENT ON TABLE public.categories IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.dishes IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.menus IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.profiles IS 'Security: RLS enabled with user ownership policies';
COMMENT ON TABLE public.complement_groups IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.complements IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.dish_categories IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.waiter_calls IS 'Security: RLS enabled with restaurant ownership policies';

-- 12. Verify final security state
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
