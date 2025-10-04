-- Migration: Add complete payment system
-- Description: Create orders, order_items tables and add is_open_for_orders field to restaurants

-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create ENUM type for order status
CREATE TYPE public.order_status AS ENUM (
    'pending_payment',
    'new',
    'in_preparation',
    'ready',
    'finished',
    'cancelled'
);

-- 2. Create orders table
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
    table_name text, -- Flexible table naming (e.g., "Mesa 10", "Balcão 2")
    
    -- Customer info as JSONB for flexibility
    customer_info jsonb, 
    
    -- Prices stored as INTEGER in cents to avoid floating point issues
    total_price integer NOT NULL CHECK (total_price >= 0),
    
    status public.order_status NOT NULL DEFAULT 'pending_payment',
    
    -- Stripe Payment Intent ID for reconciliation and refunds
    stripe_payment_intent_id text UNIQUE,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for frequent queries
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_restaurant_status ON public.orders(restaurant_id, status);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON COLUMN public.orders.total_price IS 'Total order value in cents.';
COMMENT ON COLUMN public.orders.customer_info IS 'JSONB to store customer name and phone. Ex: {"name": "João Silva", "phone": "+5581999998888"}';

-- 3. Create order_items table
CREATE TABLE public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    dish_id uuid REFERENCES public.dishes(id) ON DELETE SET NULL,
    
    quantity integer NOT NULL CHECK (quantity > 0),
    
    -- Store price at time of order to preserve history
    price_at_time_of_order integer NOT NULL CHECK (price_at_time_of_order >= 0),
    
    -- JSONB to store selected complements
    selected_complements jsonb,

    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_dish_id ON public.order_items(dish_id);

-- Enable RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON COLUMN public.order_items.price_at_time_of_order IS 'Unit price of dish in cents at exact time of purchase.';
COMMENT ON COLUMN public.order_items.selected_complements IS 'Array of JSONs with selected complements. Ex: [{"complement_id": "uuid", "name": "Bacon Extra", "price": 500}]';

-- 4. Add is_open_for_orders field to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS is_open_for_orders boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.is_open_for_orders IS 'Controls if restaurant is accepting new orders through digital menu system.';

-- 5. Create triggers for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Add constraints for data validation
ALTER TABLE public.orders 
ADD CONSTRAINT check_total_price_max 
CHECK (total_price <= 99999999); -- Max R$ 999,999.99

ALTER TABLE public.order_items 
ADD CONSTRAINT check_price_at_time_max 
CHECK (price_at_time_of_order <= 999999); -- Max R$ 9,999.99 per item

ALTER TABLE public.order_items 
ADD CONSTRAINT check_quantity_max 
CHECK (quantity <= 99); -- Max 99 items per dish
