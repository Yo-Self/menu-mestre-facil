-- SEC-05: Expose dishes to anon via a view without cost_price.

CREATE OR REPLACE VIEW public.dishes_public AS
SELECT
  d.id,
  d.name,
  d.description,
  d.price,
  d.image_url,
  d.ingredients,
  d.allergens,
  d.portion,
  d.tags,
  d.is_featured,
  d.is_available,
  d.category_id,
  d.restaurant_id,
  d.created_at,
  d.updated_at,
  d.needs_preparation,
  d.stock_quantity
FROM public.dishes d
WHERE d.is_available = true;

COMMENT ON VIEW public.dishes_public IS
  'Public menu-facing dish fields. Excludes cost_price (internal financial data).';

DROP POLICY IF EXISTS "Public can view available dishes" ON public.dishes;

REVOKE ALL ON TABLE public.dishes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dishes TO authenticated;
GRANT SELECT ON TABLE public.dishes_public TO anon, authenticated;
