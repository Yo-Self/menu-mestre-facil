-- Create restaurant_hours table
CREATE TABLE IF NOT EXISTS public.restaurant_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN DEFAULT false, -- If true, restaurant is closed this day
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(restaurant_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.restaurant_hours ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can insert their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can update their restaurant hours" ON public.restaurant_hours;
DROP POLICY IF EXISTS "Users can delete their restaurant hours" ON public.restaurant_hours;

-- Create policies for restaurant_hours
CREATE POLICY "Users can view their restaurant hours"
  ON public.restaurant_hours
  FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their restaurant hours"
  ON public.restaurant_hours
  FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their restaurant hours"
  ON public.restaurant_hours
  FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their restaurant hours"
  ON public.restaurant_hours
  FOR DELETE
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE user_id = auth.uid()
    )
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_restaurant_id ON public.restaurant_hours(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_hours_day_of_week ON public.restaurant_hours(restaurant_id, day_of_week);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_restaurant_hours_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_restaurant_hours_updated_at ON public.restaurant_hours;
CREATE TRIGGER update_restaurant_hours_updated_at
  BEFORE UPDATE ON public.restaurant_hours
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_hours_updated_at();

-- Create function to check if restaurant should be open
CREATE OR REPLACE FUNCTION is_restaurant_open(restaurant_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_day INTEGER;
  current_time_value TIME;
  hours_record RECORD;
BEGIN
  -- Get current day of week (0 = Sunday, 6 = Saturday)
  current_day := EXTRACT(DOW FROM CURRENT_TIMESTAMP);
  current_time_value := CURRENT_TIME;
  
  -- Get hours for current day
  SELECT * INTO hours_record
  FROM public.restaurant_hours
  WHERE restaurant_id = restaurant_uuid
    AND day_of_week = current_day;
  
  -- If no hours configured or closed for the day, return false
  IF hours_record IS NULL OR hours_record.is_closed THEN
    RETURN FALSE;
  END IF;
  
  -- Check if current time is within operating hours
  IF hours_record.open_time <= hours_record.close_time THEN
    -- Normal case: open_time < close_time (e.g., 09:00 - 22:00)
    RETURN current_time_value >= hours_record.open_time AND current_time_value <= hours_record.close_time;
  ELSE
    -- Crosses midnight: open_time > close_time (e.g., 22:00 - 02:00)
    RETURN current_time_value >= hours_record.open_time OR current_time_value <= hours_record.close_time;
  END IF;
END;
$$ LANGUAGE plpgsql;
