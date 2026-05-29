-- Add queue_settings column to restaurants table for real-time Smart TV queue synchronization
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS queue_settings JSONB DEFAULT '{}'::jsonb;
