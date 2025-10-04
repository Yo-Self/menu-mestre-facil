-- Migration: Add RLS policies for payment system tables
-- Description: Implement Row Level Security policies for orders and order_items tables

-- 1. RLS Policies for orders table

-- Public can view orders for restaurants that allow public access
-- This allows customers to view their own orders
CREATE POLICY "Public can view orders for public restaurants" 
ON public.orders FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = orders.restaurant_id 
        AND restaurants.open = true
    )
);

-- Restaurant owners can view all orders for their restaurants
CREATE POLICY "Restaurant owners can view their orders" 
ON public.orders FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = orders.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

-- Restaurant owners can insert orders for their restaurants
-- This allows the system to create orders programmatically
CREATE POLICY "Restaurant owners can insert orders" 
ON public.orders FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = orders.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

-- Restaurant owners can update orders for their restaurants
CREATE POLICY "Restaurant owners can update their orders" 
ON public.orders FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = orders.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

-- Restaurant owners can delete orders for their restaurants
CREATE POLICY "Restaurant owners can delete their orders" 
ON public.orders FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = orders.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

-- 2. RLS Policies for order_items table

-- Public can view order items for public restaurants
CREATE POLICY "Public can view order items for public restaurants" 
ON public.order_items FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_items.order_id 
        AND r.open = true
    )
);

-- Restaurant owners can view all order items for their restaurants
CREATE POLICY "Restaurant owners can view their order items" 
ON public.order_items FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_items.order_id 
        AND r.user_id = auth.uid()
    )
);

-- Restaurant owners can insert order items for their orders
CREATE POLICY "Restaurant owners can insert order items" 
ON public.order_items FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_items.order_id 
        AND r.user_id = auth.uid()
    )
);

-- Restaurant owners can update order items for their orders
CREATE POLICY "Restaurant owners can update their order items" 
ON public.order_items FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_items.order_id 
        AND r.user_id = auth.uid()
    )
);

-- Restaurant owners can delete order items for their orders
CREATE POLICY "Restaurant owners can delete their order items" 
ON public.order_items FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_items.order_id 
        AND r.user_id = auth.uid()
    )
);

-- 3. Additional security policies for anonymous access
-- Allow anonymous users to create orders (for customers ordering without accounts)
-- This is essential for the payment system to work with guest customers

-- Anonymous users can insert orders if restaurant allows ordering
CREATE POLICY "Anonymous users can create orders for open restaurants" 
ON public.orders FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = orders.restaurant_id 
        AND restaurants.open = true
        AND restaurants.is_open_for_orders = true
    )
);

-- Anonymous users can insert order items if the order belongs to an open restaurant
CREATE POLICY "Anonymous users can create order items for open restaurants" 
ON public.order_items FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_items.order_id 
        AND r.open = true
        AND r.is_open_for_orders = true
    )
);

-- 4. Add function to check if user can access restaurant data
-- This function will be useful for more complex authorization logic
CREATE OR REPLACE FUNCTION public.can_access_restaurant(restaurant_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = restaurant_uuid 
    AND (user_id = auth.uid() OR open = true)
  );
$$;

-- 5. Add comments for documentation
COMMENT ON FUNCTION public.can_access_restaurant(uuid) IS 'Check if current user can access restaurant data (owner or public access)';
