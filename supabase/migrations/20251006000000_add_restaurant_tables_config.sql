-- Add tables configuration to restaurants
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS has_tables BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS tables_count INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS table_categories TEXT DEFAULT 'Balcão, Salão Principal, Varanda';
