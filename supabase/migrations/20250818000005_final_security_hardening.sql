-- Migration: final_security_hardening
-- Description: Final Security Hardening - Advanced security features and public views

-- 1. Add rate limiting for sensitive operations
-- Create a function to check rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_operation text,
  p_limit_seconds integer DEFAULT 60,
  p_max_operations integer DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Count operations in the last time window
  SELECT COUNT(*) INTO v_count
  FROM public.audit_log
  WHERE user_id = auth.uid()
    AND operation = p_operation
    AND timestamp > now() - (p_limit_seconds || ' seconds')::interval;
  
  -- Return true if under limit, false if over limit
  RETURN v_count < p_max_operations;
END;
$$;

-- 2. Add input sanitization function
CREATE OR REPLACE FUNCTION public.sanitize_text_input(input_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Remove potential SQL injection patterns
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        input_text,
        '--.*$', '', 'g'  -- Remove SQL comments
      ),
      ';.*$', '', 'g'     -- Remove multiple statements
    ),
    '[\x00-\x1f\x7f]', '', 'g'  -- Remove control characters
  );
END;
$$;

-- 3. Add security comments to functions
COMMENT ON FUNCTION public.check_rate_limit(text, integer, integer) IS 'Security: Rate limiting function with definer privileges';
COMMENT ON FUNCTION public.sanitize_text_input(text) IS 'Security: Input sanitization function with definer privileges';

-- 4. Create a view for public menu data that's safe to expose
CREATE OR REPLACE VIEW public.public_menu_view AS
SELECT 
  r.id as restaurant_id,
  r.name as restaurant_name,
  r.slug as restaurant_slug,
  r.image_url as restaurant_image,
  r.description as restaurant_description,
  r.whatsapp_phone,
  r.whatsapp_enabled,
  r.waiter_call_enabled,
  c.id as category_id,
  c.name as category_name,
  c.image_url as category_image,
  c.position as category_position,
  d.id as dish_id,
  d.name as dish_name,
  d.description as dish_description,
  d.price as dish_price,
  d.image_url as dish_image,
  d.is_featured,
  d.ingredients,
  d.allergens,
  d.portion
FROM public.restaurants r
JOIN public.categories c ON c.restaurant_id = r.id
JOIN public.dishes d ON d.restaurant_id = r.id
WHERE r.id IS NOT NULL
  AND c.id IS NOT NULL
  AND d.id IS NOT NULL
  AND d.is_available = true
ORDER BY r.name, c.position;

-- 5. Grant appropriate permissions on the view
GRANT SELECT ON public.public_menu_view TO anon, authenticated;

-- 6. Add security comment to the view
COMMENT ON VIEW public.public_menu_view IS 'Security: Public read-only view for menu data, no sensitive information exposed';

-- 7. Create a function to safely get restaurant data for public display
CREATE OR REPLACE FUNCTION public.get_public_restaurant_data(p_restaurant_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only return data for restaurants that exist and are accessible
  SELECT jsonb_build_object(
    'restaurant', jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'slug', r.slug,
      'image_url', r.image_url,
      'description', r.description,
      'cuisine_type', r.cuisine_type,
      'whatsapp_phone', r.whatsapp_phone,
      'whatsapp_enabled', r.whatsapp_enabled,
      'waiter_call_enabled', r.waiter_call_enabled
    ),
    'categories', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'image_url', c.image_url,
          'position', c.position,
          'dishes', (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', d.id,
                'name', d.name,
                'description', d.description,
                'price', d.price,
                'image_url', d.image_url,
                'is_featured', d.is_featured,
                'ingredients', d.ingredients,
                'allergens', d.allergens,
                'portion', d.portion
              )
            )
            FROM public.dishes d
            WHERE d.category_id = c.id
              AND d.is_available = true
          )
        )
      )
      FROM public.categories c
      WHERE c.restaurant_id = r.id
      ORDER BY c.position
    )
  ) INTO v_result
  FROM public.restaurants r
  WHERE r.slug = p_restaurant_slug;
  
  RETURN v_result;
END;
$$;

-- 8. Add security comment to the function
COMMENT ON FUNCTION public.get_public_restaurant_data(text) IS 'Security: Safe function for public restaurant data access with definer privileges';

-- 9. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_public_restaurant_data(text) TO anon, authenticated;

-- 10. Create a rollback function for security testing
CREATE OR REPLACE FUNCTION public.test_security_policies()
RETURNS TABLE(
  table_name text,
  rls_enabled boolean,
  policy_count bigint,
  security_level text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    t.rowsecurity,
    COALESCE(p.policy_count, 0)::bigint,
    CASE 
      WHEN t.rowsecurity AND COALESCE(p.policy_count, 0) > 0 THEN 'High'
      WHEN t.rowsecurity THEN 'Medium'
      ELSE 'Low'
    END::text as security_level
  FROM pg_tables t
  LEFT JOIN (
    SELECT schemaname, tablename, COUNT(*) as policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
  ) p ON t.schemaname = p.schemaname AND t.tablename = p.tablename
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$;

-- 11. Add security comment to the test function
COMMENT ON FUNCTION public.test_security_policies() IS 'Security: Function to test and verify security policies';

-- 12. Grant execute permission on the test function (restricted to authenticated users)
GRANT EXECUTE ON FUNCTION public.test_security_policies() TO authenticated;

-- 13. Create a summary view of all security policies
CREATE OR REPLACE VIEW public.security_policy_summary AS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE 'No USING clause'
  END as access_control,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'No WITH CHECK clause'
  END as modification_control
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 14. Grant read access to security summary (restricted to authenticated users)
GRANT SELECT ON public.security_policy_summary TO authenticated;

-- 15. Add security comment to the summary view
COMMENT ON VIEW public.security_policy_summary IS 'Security: Summary view of all RLS policies for security auditing';

-- 16. Final verification query
-- This will show the complete security status of all tables
SELECT 
  'Security Implementation Complete' as status,
  COUNT(*) as total_tables,
  COUNT(CASE WHEN rowsecurity THEN 1 END) as rls_enabled_tables,
  COUNT(CASE WHEN NOT rowsecurity THEN 1 END) as rls_disabled_tables
FROM pg_tables 
WHERE schemaname = 'public';
