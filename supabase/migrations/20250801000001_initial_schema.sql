-- Migration: initial_schema
-- Description: Create initial database schema with all core tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create profiles table (user profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  slug text NOT NULL UNIQUE,
  is_organization boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create restaurants table
CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  cuisine_type text NOT NULL,
  description text,
  image_url text NOT NULL,
  welcome_message text,
  whatsapp_enabled boolean DEFAULT false,
  whatsapp_phone text,
  whatsapp_custom_message text,
  waiter_call_enabled boolean DEFAULT false,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  position integer,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create dishes table
CREATE TABLE IF NOT EXISTS public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text NOT NULL,
  ingredients text,
  allergens text,
  portion text,
  tags text[] DEFAULT '{}',
  is_featured boolean DEFAULT false,
  is_available boolean DEFAULT true,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create menus table
CREATE TABLE IF NOT EXISTS public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create waiter_calls table
CREATE TABLE IF NOT EXISTS public.waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  attended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  attended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create dish_categories junction table
CREATE TABLE IF NOT EXISTS public.dish_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dish_id, category_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON public.restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant_id ON public.categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON public.dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_dishes_category_id ON public.dishes(category_id);
CREATE INDEX IF NOT EXISTS idx_dishes_is_available ON public.dishes(is_available);
CREATE INDEX IF NOT EXISTS idx_dishes_is_featured ON public.dishes(is_featured);
CREATE INDEX IF NOT EXISTS idx_menus_restaurant_id ON public.menus(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_id ON public.waiter_calls(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_status ON public.waiter_calls(status);
CREATE INDEX IF NOT EXISTS idx_dish_categories_dish_id ON public.dish_categories(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_categories_category_id ON public.dish_categories(category_id);

-- Create function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dishes_updated_at
  BEFORE UPDATE ON public.dishes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menus_updated_at
  BEFORE UPDATE ON public.menus
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dish_categories_updated_at
  BEFORE UPDATE ON public.dish_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view and update their own profile" 
ON public.profiles 
FOR ALL 
USING (auth.uid() = id);

-- Create RLS policies for restaurants
CREATE POLICY "Public can view restaurants" 
ON public.restaurants 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own restaurants" 
ON public.restaurants 
FOR ALL 
USING (auth.uid() = user_id);

-- Create RLS policies for categories
CREATE POLICY "Public can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage categories of their restaurants" 
ON public.categories 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = categories.restaurant_id 
  AND r.user_id = auth.uid()
));

-- Create RLS policies for dishes
CREATE POLICY "Public can view available dishes" 
ON public.dishes 
FOR SELECT 
USING (is_available = true);

CREATE POLICY "Users can manage dishes of their restaurants" 
ON public.dishes 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = dishes.restaurant_id 
  AND r.user_id = auth.uid()
));

-- Create RLS policies for menus
CREATE POLICY "Public can view active menus" 
ON public.menus 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Users can manage menus of their restaurants" 
ON public.menus 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = menus.restaurant_id 
  AND r.user_id = auth.uid()
));

-- Create RLS policies for waiter_calls
CREATE POLICY "Public can create waiter calls" 
ON public.waiter_calls 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can manage waiter calls for their restaurants" 
ON public.waiter_calls 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = waiter_calls.restaurant_id 
  AND r.user_id = auth.uid()
));

-- Create RLS policies for dish_categories
CREATE POLICY "Public can view dish categories" 
ON public.dish_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage dish categories for their restaurants" 
ON public.dish_categories 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  JOIN public.dishes d ON d.restaurant_id = r.id
  WHERE d.id = dish_categories.dish_id 
  AND r.user_id = auth.uid()
));
