-- Enable Supabase Realtime for orders (gestor kanban via postgres_changes + RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Remove permissive public SELECT on order_items (anon could read all items via REST)
DROP POLICY IF EXISTS "public_can_select_order_items" ON public.order_items;
