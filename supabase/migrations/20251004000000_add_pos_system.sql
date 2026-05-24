-- Migration: Add POS System Database Schema
-- Description: Create pos_sessions, pos_transactions, and order_payments tables, update orders table, and set up RLS policies.

-- 1. Create ENUM type for POS session status
CREATE TYPE public.pos_session_status AS ENUM (
    'open',
    'closed'
);

-- 2. Create pos_sessions table (for Cash Register / Controle de Caixa)
CREATE TABLE public.pos_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- User who opened the cash register
    
    status public.pos_session_status NOT NULL DEFAULT 'open',
    opened_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    
    -- Values stored in cents (integers)
    initial_balance integer NOT NULL CHECK (initial_balance >= 0),
    final_balance integer CHECK (final_balance >= 0),
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for pos_sessions
CREATE INDEX idx_pos_sessions_restaurant_id ON public.pos_sessions(restaurant_id);
CREATE INDEX idx_pos_sessions_status ON public.pos_sessions(status);
CREATE INDEX idx_pos_sessions_restaurant_status ON public.pos_sessions(restaurant_id, status);

-- Enable RLS for pos_sessions
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Create pos_transactions table (for Cash Operations - Sangria/Suprimento)
CREATE TABLE public.pos_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.pos_sessions(id) ON DELETE CASCADE,
    
    type text NOT NULL CHECK (type IN ('in', 'out')), -- 'in' = suprimento (add cash), 'out' = sangria (remove cash)
    amount integer NOT NULL CHECK (amount > 0), -- in cents
    description text,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for pos_transactions
CREATE INDEX idx_pos_transactions_session_id ON public.pos_transactions(session_id);

-- Enable RLS for pos_transactions
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

-- 4. Create order_payments table (to support Split Payments / Multi-payment methods)
CREATE TABLE public.order_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    
    method text NOT NULL CHECK (method IN ('cash', 'credit_card', 'debit_card', 'pix', 'stripe')),
    amount integer NOT NULL CHECK (amount > 0), -- in cents
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for order_payments
CREATE INDEX idx_order_payments_order_id ON public.order_payments(order_id);

-- Enable RLS for order_payments
ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- 5. Modify orders table to add origin and link to POS Session
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'web_menu' CHECK (origin IN ('web_menu', 'pos', 'ifood', 'whatsapp')),
ADD COLUMN IF NOT EXISTS pos_session_id uuid REFERENCES public.pos_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pos_session_id ON public.orders(pos_session_id);

-- 6. Add triggers for updated_at on pos_sessions
CREATE TRIGGER update_pos_sessions_updated_at
  BEFORE UPDATE ON public.pos_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Add comments for database documentation
COMMENT ON TABLE public.pos_sessions IS 'Stores POS cash register sessions opened by restaurant managers.';
COMMENT ON COLUMN public.pos_sessions.initial_balance IS 'Starting cash amount in cents.';
COMMENT ON COLUMN public.pos_sessions.final_balance IS 'Ending cash amount in cents recorded at closure.';

COMMENT ON TABLE public.pos_transactions IS 'Tracks cash adjustments (Sangria and Suprimento) during an active POS session.';
COMMENT ON COLUMN public.pos_transactions.type IS 'Operation type: in (suprimento) or out (sangria).';

COMMENT ON TABLE public.order_payments IS 'Stores payment details for orders, allowing multiple payment methods for a single order.';

-- 8. Row Level Security (RLS) Policies

-- policies for pos_sessions
CREATE POLICY "Restaurant owners can manage their POS sessions" 
ON public.pos_sessions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = pos_sessions.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.restaurants 
        WHERE restaurants.id = pos_sessions.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

-- policies for pos_transactions
CREATE POLICY "Restaurant owners can manage transactions in their sessions" 
ON public.pos_transactions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.pos_sessions s
        JOIN public.restaurants r ON s.restaurant_id = r.id
        WHERE s.id = pos_transactions.session_id 
        AND r.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.pos_sessions s
        JOIN public.restaurants r ON s.restaurant_id = r.id
        WHERE s.id = pos_transactions.session_id 
        AND r.user_id = auth.uid()
    )
);

-- policies for order_payments
CREATE POLICY "Restaurant owners can manage payments for their orders" 
ON public.order_payments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_payments.order_id 
        AND r.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_payments.order_id 
        AND r.user_id = auth.uid()
    )
);

CREATE POLICY "Public can view order payments for public restaurants" 
ON public.order_payments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.restaurants r ON o.restaurant_id = r.id
        WHERE o.id = order_payments.order_id 
        AND r.open = true
    )
);
