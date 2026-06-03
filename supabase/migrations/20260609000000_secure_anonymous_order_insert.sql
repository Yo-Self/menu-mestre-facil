-- Migration: secure_anonymous_order_insert
-- Description: Restrict anonymous order inserts to safe statuses and block payment bypass
-- when online_payment is enabled on the restaurant.

-- Replace the permissive anonymous insert policy with status-aware rules:
-- - pending_payment: allowed for all open restaurants accepting orders (Stripe, WhatsApp, etc.)
-- - new: allowed only for table_ordering restaurants WITHOUT mandatory online payment
-- - any other status: blocked for anonymous users (only owners/service role may set these)

DROP POLICY IF EXISTS "Anonymous users can create orders for open restaurants" ON public.orders;

CREATE POLICY "Anonymous users can create orders for open restaurants"
ON public.orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = orders.restaurant_id
      AND r.open = true
      AND r.is_open_for_orders = true
  )
  AND (
    orders.status = 'pending_payment'
    OR (
      orders.status = 'new'
      AND EXISTS (
        SELECT 1
        FROM public.restaurants r
        WHERE r.id = orders.restaurant_id
          AND r.table_ordering = true
          AND r.online_payment = false
      )
    )
  )
);

COMMENT ON POLICY "Anonymous users can create orders for open restaurants" ON public.orders IS
  'Anonymous customers may insert pending_payment (online payment flows) or new (table ordering without online payment). Other statuses require owner or service role.';
