-- Migration: Create financial system
-- Description: Create expenses table, employees table, and add cost_price column to dishes table for complete financial management.

-- 1. Add cost_price to dishes table
ALTER TABLE public.dishes
ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT NULL;

COMMENT ON COLUMN public.dishes.cost_price IS 'Production cost or raw cost of the dish. NULL represents no cost specified.';

-- 2. Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name text NOT NULL,
    role text, -- e.g. 'Garçom', 'Cozinheiro', 'Gerente', etc.
    salary numeric NOT NULL CHECK (salary >= 0), -- Base salary
    hire_date date NOT NULL,
    status text NOT NULL DEFAULT 'active', -- 'active' or 'inactive'
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_employees_restaurant_id ON public.employees(restaurant_id);

-- 3. Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    description text NOT NULL,
    amount numeric NOT NULL CHECK (amount >= 0),
    category text NOT NULL, -- e.g., 'Aluguel', 'Ingredientes', 'Pessoal', 'Serviços', 'Marketing', 'Impostos', 'Outros'
    due_date date NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- 'paid' or 'pending'
    is_recurring boolean NOT NULL DEFAULT false,
    recurrence_period text DEFAULT NULL, -- 'weekly', 'monthly'
    parent_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
    employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL, -- optional relationship to employee
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_restaurant_id ON public.expenses(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_due_date ON public.expenses(due_date);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Enable triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add RLS Policies for employees
CREATE POLICY "Users can manage employees of their restaurants" 
ON public.employees 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = employees.restaurant_id 
  AND r.user_id = auth.uid()
));

-- Add RLS Policies for expenses
CREATE POLICY "Users can manage expenses of their restaurants" 
ON public.expenses 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = expenses.restaurant_id 
  AND r.user_id = auth.uid()
));
