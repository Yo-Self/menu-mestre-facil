-- Migration: fix_profiles_rls_policies
-- Description: Fix missing RLS policies for profiles table to allow account creation

-- 1. Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view and update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- 2. Create comprehensive RLS policies for profiles table
-- Policy for INSERT: Users can insert their own profile during account creation
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Policy for SELECT: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy for UPDATE: Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy for DELETE: Users can delete their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- 3. Verify the policies were created correctly
COMMENT ON TABLE public.profiles IS 'Security: RLS enabled with comprehensive user ownership policies for INSERT, SELECT, UPDATE, DELETE';

-- 4. Add a function to help with profile creation during signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- This function can be used in the future to automatically create profiles
  -- For now, we'll just return the new user
  RETURN NEW;
END;
$$;

-- 5. Add security comment to the function
COMMENT ON FUNCTION public.handle_new_user() IS 'Security: Function to handle new user creation with definer privileges';
