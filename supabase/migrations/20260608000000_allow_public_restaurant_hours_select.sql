-- Allow public select on restaurant_hours table
-- This enables anonymous customers browsing the website to view the operating hours.
DROP POLICY IF EXISTS "Allow public select on restaurant_hours" ON public.restaurant_hours;
CREATE POLICY "Allow public select on restaurant_hours"
  ON public.restaurant_hours
  FOR SELECT
  USING (true);
