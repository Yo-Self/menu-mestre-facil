-- Quick migration script for restaurant hours
-- Run this in Supabase SQL Editor if needed

-- This will create the restaurant_hours table and all related functions/triggers
-- Safe to run multiple times (uses IF NOT EXISTS)

\i supabase/migrations/20250109000000_create_restaurant_hours.sql
