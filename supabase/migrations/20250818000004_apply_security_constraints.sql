-- Migration: apply_security_constraints
-- Description: Apply security constraints after fixing data

-- 1. Add data validation constraints
ALTER TABLE public.restaurants 
DROP CONSTRAINT IF EXISTS check_restaurant_name_length;
ALTER TABLE public.restaurants 
ADD CONSTRAINT check_restaurant_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

ALTER TABLE public.dishes 
DROP CONSTRAINT IF EXISTS check_dish_name_length;
ALTER TABLE public.dishes 
ADD CONSTRAINT check_dish_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 100);

ALTER TABLE public.categories 
DROP CONSTRAINT IF EXISTS check_category_name_length;
ALTER TABLE public.categories 
ADD CONSTRAINT check_category_name_length 
CHECK (char_length(name) >= 1 AND char_length(name) <= 50);

-- 2. Add URL validation constraints
ALTER TABLE public.restaurants 
DROP CONSTRAINT IF EXISTS check_valid_image_url;
ALTER TABLE public.restaurants 
ADD CONSTRAINT check_valid_image_url 
CHECK (image_url IS NULL OR image_url ~ '^https?://');

ALTER TABLE public.dishes 
DROP CONSTRAINT IF EXISTS check_valid_dish_image_url;
ALTER TABLE public.dishes 
ADD CONSTRAINT check_valid_dish_image_url 
CHECK (image_url IS NULL OR image_url ~ '^https?://');

ALTER TABLE public.categories 
DROP CONSTRAINT IF EXISTS check_valid_category_image_url;
ALTER TABLE public.categories 
ADD CONSTRAINT check_valid_category_image_url 
CHECK (image_url IS NULL OR image_url ~ '^https?://');

-- 3. Add phone number validation for WhatsApp
ALTER TABLE public.restaurants 
DROP CONSTRAINT IF EXISTS check_valid_whatsapp_phone;
ALTER TABLE public.restaurants 
ADD CONSTRAINT check_valid_whatsapp_phone 
CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^\+[1-9]\d{1,14}$');

-- 4. Ensure all foreign key relationships are properly indexed for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON public.restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON public.dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON public.dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_menus_restaurant_id ON public.menus(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_id ON public.waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_attended_by ON public.waiter_calls(attended_by);

-- 5. Create audit trail table for sensitive operations
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
DROP POLICY IF EXISTS "Users can view their own audit entries" ON public.audit_log;
CREATE POLICY "Users can view their own audit entries"
ON public.audit_log
FOR SELECT
USING (user_id = auth.uid());

-- 6. Create function to log audit entries
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

-- 7. Add security comments
COMMENT ON TABLE public.audit_log IS 'Security: Audit trail for sensitive operations';
COMMENT ON FUNCTION public.log_audit_entry(text, text, uuid, jsonb, jsonb) IS 'Security: Function to log audit entries with definer privileges';

-- 8. Add security comments to existing tables
COMMENT ON TABLE public.restaurants IS 'Security: RLS enabled with user ownership policies';
COMMENT ON TABLE public.categories IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.dishes IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.menus IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.profiles IS 'Security: RLS enabled with user ownership policies';
COMMENT ON TABLE public.complement_groups IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.complements IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.dish_categories IS 'Security: RLS enabled with restaurant ownership policies';
COMMENT ON TABLE public.waiter_calls IS 'Security: RLS enabled with restaurant ownership policies';
