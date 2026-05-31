-- Migration: Add needs_preparation to dishes, sent_to_kitchen to order_items and triggers for kitchen routing
-- Description: Add fields and create triggers to bypass kitchen preparation when no items need prep

-- 1. Add needs_preparation to dishes table
ALTER TABLE public.dishes
ADD COLUMN IF NOT EXISTS needs_preparation boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.dishes.needs_preparation IS 'Indicates if this dish requires kitchen preparation.';

-- 2. Add sent_to_kitchen to order_items table
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS sent_to_kitchen boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.order_items.sent_to_kitchen IS 'Indicates if this specific item should be sent to the kitchen for preparation.';

-- 3. Create function and trigger for AFTER INSERT on order_items
CREATE OR REPLACE FUNCTION public.check_order_items_preparation()
RETURNS TRIGGER AS $$
DECLARE
  v_order_status public.order_status;
  v_origin TEXT;
  v_pos_session_id UUID;
  v_needs_prep BOOLEAN;
BEGIN
  -- Get the current status, origin, and pos_session_id of the order
  SELECT status, origin, pos_session_id INTO v_order_status, v_origin, v_pos_session_id
  FROM public.orders
  WHERE id = NEW.order_id;

  -- Bypassing should only occur for POS/Waiter orders (origin = 'pos' or pos_session_id is not null)
  IF v_order_status = 'new' AND (v_origin = 'pos' OR v_pos_session_id IS NOT NULL) THEN
    SELECT COALESCE(bool_or(sent_to_kitchen), false)
    INTO v_needs_prep
    FROM public.order_items
    WHERE order_id = NEW.order_id;

    -- If none of the items are sent to the kitchen, update the order status to 'finished'
    IF NOT v_needs_prep THEN
      UPDATE public.orders
      SET status = 'finished'
      WHERE id = NEW.order_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_order_items_preparation ON public.order_items;
CREATE TRIGGER trg_check_order_items_preparation
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.check_order_items_preparation();

-- 4. Create function and trigger for BEFORE UPDATE on orders
CREATE OR REPLACE FUNCTION public.route_order_by_preparation()
RETURNS TRIGGER AS $$
DECLARE
  v_needs_prep BOOLEAN;
BEGIN
  -- When status transitions to 'new' and it is a POS/Waiter order
  IF (NEW.status = 'new') AND (NEW.origin = 'pos' OR NEW.pos_session_id IS NOT NULL) THEN
    -- Check if any of the items are marked to be sent to the kitchen
    SELECT COALESCE(bool_or(sent_to_kitchen), false)
    INTO v_needs_prep
    FROM public.order_items
    WHERE order_id = NEW.id;

    -- If no items need kitchen preparation, bypass to 'finished'
    IF NOT v_needs_prep THEN
      NEW.status := 'finished';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_route_order_by_preparation ON public.orders;
CREATE TRIGGER trg_route_order_by_preparation
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.route_order_by_preparation();
