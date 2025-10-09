-- ==================================================
-- SCRIPT COMPLETO: Restaurant Hours
-- Execute TUDO de uma vez no Supabase SQL Editor
-- ==================================================

-- Step 1: Drop existing table if needed (CUIDADO: apaga dados!)
-- DROP TABLE IF EXISTS public.restaurant_hours CASCADE;

-- Step 2: Create table
CREATE TABLE IF NOT EXISTS public.restaurant_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(restaurant_id, day_of_week)
);

-- Step 3: Enable RLS
ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop old policies
DROP POLICY IF EXISTS "Users can view their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can insert their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can update their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can delete their restaurant hours" ON public.restaurant_hours;

-- Step 5: Create new policies
CREATE POLICY "Users can view their restaurant hours"
  ON public.restaurant_hours FOR SELECT
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert their restaurant hours"
  ON public.restaurant_hours FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their restaurant hours"
  ON public.restaurant_hours FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their restaurant hours"
  ON public.restaurant_hours FOR DELETE
  USING (restaurant_id IN (SELECT id FROM public.restaurants WHERE user_id = auth.uid()));

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_restaurant_id ON public.restaurant_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_day_of_week ON public.restaurant_hours(restaurant_id, day_of_week);

-- Step 7: Create update trigger function
CREATE OR REPLACE FUNCTION public.update_restaurant_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create trigger
DROP TRIGGER IF EXISTS update_restaurant_hours_updated_at ON public.restaurant_hours;
CREATE TRIGGER update_restaurant_hours_updated_at
  BEFORE UPDATE ON public.restaurant_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_restaurant_hours_updated_at();

-- Step 9: Create helper function
CREATE OR REPLACE FUNCTION public.is_restaurant_open(restaurant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_day INTEGER;
  current_time_value TIME;
  hours_record RECORD;
BEGIN
  current_day := EXTRACT(DOW FROM CURRENT_TIMESTAMP);
  current_time_value := CURRENT_TIME;
  
  SELECT * INTO hours_record
  FROM public.restaurant_hours
  WHERE restaurant_id = restaurant_uuid
    AND day_of_week = current_day;
  
  IF hours_record IS NULL OR hours_record.is_closed THEN
    RETURN FALSE;
  END IF;
  
  IF hours_record.open_time <= hours_record.close_time THEN
    RETURN current_time_value >= hours_record.open_time AND current_time_value <= hours_record.close_time;
  ELSE
    RETURN current_time_value >= hours_record.open_time OR current_time_value <= hours_record.close_time;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Grant permissions (IMPORTANTE!)
GRANT ALL ON public.restaurant_hours TO authenticated;
GRANT ALL ON public.restaurant_hours TO service_role;

-- Step 11: Verify table was created
SELECT 
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_name = 'restaurant_hours';

-- Step 12: Force API reload
NOTIFY pgrst, 'reload schema';

-- ==================================================
-- FIM DO SCRIPT
-- Você deve ver "restaurant_hours | public" no resultado
-- ==================================================
