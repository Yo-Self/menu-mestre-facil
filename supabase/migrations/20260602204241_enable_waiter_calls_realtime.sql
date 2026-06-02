-- Enable Supabase Realtime for waiter_calls (gestor listens via postgres_changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'waiter_calls'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;
  END IF;
END $$;
