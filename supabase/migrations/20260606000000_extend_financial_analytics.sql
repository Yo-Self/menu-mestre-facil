-- Migration: Extend financial analytics
-- Description: Add expense type (fixed/variable) to expenses table for break-even calculations.

-- 1. Add type column to expenses table
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'variable' CHECK (type IN ('fixed', 'variable'));

COMMENT ON COLUMN public.expenses.type IS 'Type of the expense: fixed (structural costs like Rent, Salaries) or variable (ingredients, payment gateway card fees, taxes).';
