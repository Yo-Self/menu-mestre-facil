-- Migration: fix_import_restaurant_function
-- Description: Fix import restaurant function to allow creating new restaurants

-- Create an improved version that can create new restaurants
CREATE OR REPLACE FUNCTION public.import_restaurant_from_json(p_payload jsonb, p_cuisine text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_restaurant_id restaurants.id%TYPE;
  v_rest_name text := p_payload->>'restaurant_name';
  v_rest_image text := p_payload->>'restaurant_image';
  v_rest_desc text := p_payload->>'restaurant_description';
  v_cuisine text := coalesce(p_cuisine, p_payload->>'cuisine_type', 'Geral');

  rec_cat text;
  v_category_id categories.id%TYPE;

  v_has_featured boolean;
  rec_feat jsonb;
  rec_item jsonb;

  v_item_name text;
  v_item_desc text;
  v_item_price numeric;
  v_item_img text;
  v_item_cat text;
  v_item_is_featured boolean;
  v_item_is_available boolean := true;

  v_dish_id dishes.id%TYPE;

  rec_group jsonb;
  rec_comp jsonb;
  v_group_id complement_groups.id%TYPE;
  v_group_title text;
  v_group_desc text;
  v_group_required boolean;
  v_group_max integer;
  v_gpos integer;
  v_cpos integer;
  v_comp_name text;
  v_comp_desc text;
  v_comp_price numeric;
  v_comp_img text;
  v_comp_ingredients text;
BEGIN
  -- Try to find existing restaurant owned by current user
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE name = v_rest_name
    AND user_id = auth.uid()
  LIMIT 1;

  -- If restaurant doesn't exist, create it
  IF NOT FOUND THEN
    -- Generate a unique slug for the restaurant
    INSERT INTO restaurants (
      name, 
      cuisine_type, 
      image_url, 
      description, 
      user_id,
      slug
    )
    VALUES (
      v_rest_name, 
      v_cuisine, 
      v_rest_image, 
      v_rest_desc, 
      auth.uid(),
      lower(regexp_replace(v_rest_name, '[^a-zA-Z0-9]+', '-', 'g'))
    )
    RETURNING id INTO v_restaurant_id;
  ELSE
    -- Update existing restaurant
    UPDATE restaurants
      SET image_url = v_rest_image,
          description = v_rest_desc,
          cuisine_type = coalesce(v_cuisine, cuisine_type),
          updated_at = now()
    WHERE id = v_restaurant_id
      AND user_id = auth.uid();
  END IF;

  -- Process categories
  FOR rec_cat IN
    SELECT jsonb_array_elements_text(p_payload->'menu_categories')
  LOOP
    SELECT id INTO v_category_id
    FROM categories
    WHERE restaurant_id = v_restaurant_id
      AND name = rec_cat
    LIMIT 1;

    IF NOT FOUND THEN
      INSERT INTO categories (name, image_url, restaurant_id)
      VALUES (rec_cat, null, v_restaurant_id)
      RETURNING id INTO v_category_id;
    END IF;
  END LOOP;

  -- Process featured dishes
  CREATE TEMPORARY TABLE IF NOT EXISTS tmp_featured_names (name text PRIMARY KEY) ON COMMIT DROP;
  TRUNCATE tmp_featured_names;

  IF jsonb_typeof(p_payload->'featured_dishes') = 'array' THEN
    FOR rec_feat IN SELECT jsonb_array_elements(p_payload->'featured_dishes')
    LOOP
      INSERT INTO tmp_featured_names(name)
      VALUES ((rec_feat->>'name'))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Process menu items
  IF jsonb_typeof(p_payload->'menu_items') = 'array' THEN
    FOR rec_item IN SELECT jsonb_array_elements(p_payload->'menu_items')
    LOOP
      v_item_name := rec_item->>'name';
      v_item_desc := coalesce(rec_item->>'description', '');
      v_item_img  := coalesce(rec_item->>'image', '');
      v_item_cat  := coalesce(rec_item->>'category', 'Sem categoria');

      v_item_price := NULL;
      BEGIN
        v_item_price := replace(coalesce(rec_item->>'price','0,00'), ',', '.')::numeric;
      EXCEPTION WHEN others THEN
        v_item_price := 0;
      END;

      v_item_is_featured := false;
      v_has_featured := false;

      IF (rec_item ? 'tags') AND jsonb_typeof(rec_item->'tags') = 'array' THEN
        v_has_featured := EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(rec_item->'tags') t(tag)
          WHERE tag = 'Destaque'
        );
      END IF;

      IF NOT v_has_featured THEN
        v_has_featured := EXISTS (
          SELECT 1 FROM tmp_featured_names f WHERE f.name = v_item_name
        );
      END IF;

      v_item_is_featured := v_has_featured;

      -- Ensure category exists
      SELECT id INTO v_category_id
      FROM categories
      WHERE restaurant_id = v_restaurant_id
        AND name = v_item_cat
      LIMIT 1;

      IF NOT FOUND THEN
        INSERT INTO categories (name, image_url, restaurant_id)
        VALUES (v_item_cat, null, v_restaurant_id)
        RETURNING id INTO v_category_id;
      END IF;

      -- Upsert dish
      IF EXISTS (
        SELECT 1 FROM dishes
        WHERE restaurant_id = v_restaurant_id
          AND name = v_item_name
          AND category_id = v_category_id
      ) THEN
        UPDATE dishes
          SET description = v_item_desc,
              price = v_item_price,
              image_url = v_item_img,
              is_featured = v_item_is_featured,
              is_available = true,
              updated_at = now()
        WHERE restaurant_id = v_restaurant_id
          AND name = v_item_name
          AND category_id = v_category_id;

        SELECT id INTO v_dish_id
        FROM dishes
        WHERE restaurant_id = v_restaurant_id
          AND name = v_item_name
          AND category_id = v_category_id
        LIMIT 1;
      ELSE
        INSERT INTO dishes
          (name, description, price, image_url, category_id, restaurant_id, is_featured, is_available)
        VALUES
          (v_item_name, v_item_desc, v_item_price, v_item_img, v_category_id, v_restaurant_id, v_item_is_featured, true)
        RETURNING id INTO v_dish_id;
      END IF;

      -- Process complement groups
      IF v_dish_id IS NOT NULL THEN
        DELETE FROM complement_groups WHERE dish_id = v_dish_id;

        IF (rec_item ? 'complement_groups') AND jsonb_typeof(rec_item->'complement_groups') = 'array' THEN
          v_gpos := 0;
          FOR rec_group IN SELECT jsonb_array_elements(rec_item->'complement_groups')
          LOOP
            v_gpos := v_gpos + 1;
            v_group_title := coalesce(rec_group->>'title', '');
            v_group_desc := coalesce(rec_group->>'description', NULL);
            v_group_required := coalesce((rec_group->>'required')::boolean, false);
            v_group_max := coalesce((rec_group->>'max_selections')::int, 1);

            INSERT INTO complement_groups (dish_id, title, description, required, max_selections, position)
            VALUES (v_dish_id, v_group_title, v_group_desc, v_group_required, v_group_max, v_gpos)
            RETURNING id INTO v_group_id;

            -- Process complements
            IF (rec_group ? 'complements') AND jsonb_typeof(rec_group->'complements') = 'array' THEN
              v_cpos := 0;
              FOR rec_comp IN SELECT jsonb_array_elements(rec_group->'complements')
              LOOP
                v_cpos := v_cpos + 1;
                v_comp_name := coalesce(rec_comp->>'name','');
                v_comp_desc := coalesce(rec_comp->>'description', NULL);
                v_comp_img  := coalesce(rec_comp->>'image', NULL);
                v_comp_ingredients := coalesce(rec_comp->>'ingredients', NULL);

                v_comp_price := 0;
                BEGIN
                  v_comp_price := replace(coalesce(rec_comp->>'price','0,00'), ',', '.')::numeric;
                EXCEPTION WHEN others THEN
                  v_comp_price := 0;
                END;

                INSERT INTO complements (group_id, name, description, price, image_url, ingredients, position)
                VALUES (v_group_id, v_comp_name, v_comp_desc, v_comp_price, v_comp_img, v_comp_ingredients, v_cpos);
              END LOOP;
            END IF;
          END LOOP;
        END IF;
      END IF;

    END LOOP;
  END IF;

END;
$function$;

-- Create the version with complements support
CREATE OR REPLACE FUNCTION public.import_restaurant_with_complements_from_json(p_payload jsonb, p_cuisine text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  -- This function is identical to import_restaurant_from_json now
  -- since that function already handles complements
  PERFORM public.import_restaurant_from_json(p_payload, p_cuisine);
END;
$function$;

-- Add security comments
COMMENT ON FUNCTION public.import_restaurant_from_json(jsonb, text) IS 'Security: Function runs with definer privileges and allows creating new restaurants for authenticated users';
COMMENT ON FUNCTION public.import_restaurant_with_complements_from_json(jsonb, text) IS 'Security: Function runs with definer privileges and supports complement groups';

-- Add RLS policy to allow users to create restaurants
DROP POLICY IF EXISTS "Users can create their own restaurants" ON public.restaurants;
CREATE POLICY "Users can create their own restaurants"
ON public.restaurants
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add RLS policy to allow users to update their own restaurants
DROP POLICY IF EXISTS "Users can update their own restaurants" ON public.restaurants;
CREATE POLICY "Users can update their own restaurants"
ON public.restaurants
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Add RLS policy to allow users to view their own restaurants
DROP POLICY IF EXISTS "Users can view their own restaurants" ON public.restaurants;
CREATE POLICY "Users can view their own restaurants"
ON public.restaurants
FOR SELECT
USING (user_id = auth.uid() OR true); -- Also allow public access as per previous migration

-- Add policies for categories, dishes, and complements
DROP POLICY IF EXISTS "Users can manage categories for their restaurants" ON public.categories;
CREATE POLICY "Users can manage categories for their restaurants"
ON public.categories
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = categories.restaurant_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = categories.restaurant_id
      AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage dishes for their restaurants" ON public.dishes;
CREATE POLICY "Users can manage dishes for their restaurants"
ON public.dishes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = dishes.restaurant_id
      AND r.user_id = auth.uid()
  ) OR is_available = true -- Allow public read access for available dishes
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = dishes.restaurant_id
      AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage complement groups for their dishes" ON public.complement_groups;
CREATE POLICY "Users can manage complement groups for their dishes"
ON public.complement_groups
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.dishes d ON d.restaurant_id = r.id
    WHERE d.id = complement_groups.dish_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.dishes d ON d.restaurant_id = r.id
    WHERE d.id = complement_groups.dish_id
      AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can manage complements for their dishes" ON public.complements;
CREATE POLICY "Users can manage complements for their dishes"
ON public.complements
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.dishes d ON d.restaurant_id = r.id
    JOIN public.complement_groups cg ON cg.dish_id = d.id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    JOIN public.dishes d ON d.restaurant_id = r.id
    JOIN public.complement_groups cg ON cg.dish_id = d.id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
);
