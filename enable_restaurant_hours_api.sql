-- Enable API access for restaurant_hours table
-- This needs to be run in Supabase Dashboard

-- First, verify the table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'restaurant_hours';

-- The table should be automatically exposed via PostgREST
-- But if it's not, we need to ensure it's in the right schema
-- and that the API schema includes it

-- Check current API schema
SHOW pgrst.db_schemas;

-- Typically, public schema should be exposed by default
-- If not, you may need to contact Supabase support or check your project settings
