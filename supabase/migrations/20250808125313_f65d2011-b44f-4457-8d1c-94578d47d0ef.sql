-- 1) Create complement_groups and complements tables
-- Using idempotent patterns where possible

-- Enable required extension for gen_random_uuid if not already (usually enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table: complement_groups
CREATE TABLE IF NOT EXISTS public.complement_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  required boolean NOT NULL DEFAULT false,
  max_selections integer NOT NULL DEFAULT 1,
  position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_complement_groups_dish
    FOREIGN KEY (dish_id)
    REFERENCES public.dishes(id)
    ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_complement_groups_dish_id ON public.complement_groups(dish_id);

-- Table: complements
CREATE TABLE IF NOT EXISTS public.complements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  image_url text,
  ingredients text,
  position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_complements_group
    FOREIGN KEY (group_id)
    REFERENCES public.complement_groups(id)
    ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_complements_group_id ON public.complements(group_id);

-- 2) Enable RLS
ALTER TABLE public.complement_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complements ENABLE ROW LEVEL SECURITY;

-- 3) Policies (drop and recreate to keep deterministic)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complement_groups' AND policyname='Public can view complement groups') THEN
    DROP POLICY "Public can view complement groups" ON public.complement_groups;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complement_groups' AND policyname='Restaurant owners can manage their complement groups') THEN
    DROP POLICY "Restaurant owners can manage their complement groups" ON public.complement_groups;
  END IF;
END $$;

CREATE POLICY "Public can view complement groups"
ON public.complement_groups
FOR SELECT
USING (true);

CREATE POLICY "Restaurant owners can manage their complement groups"
ON public.complement_groups
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.dishes d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE d.id = complement_groups.dish_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.dishes d
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE d.id = complement_groups.dish_id
      AND r.user_id = auth.uid()
  )
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complements' AND policyname='Public can view complements') THEN
    DROP POLICY "Public can view complements" ON public.complements;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complements' AND policyname='Restaurant owners can manage their complements') THEN
    DROP POLICY "Restaurant owners can manage their complements" ON public.complements;
  END IF;
END $$;

CREATE POLICY "Public can view complements"
ON public.complements
FOR SELECT
USING (true);

CREATE POLICY "Restaurant owners can manage their complements"
ON public.complements
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.complement_groups cg
    JOIN public.dishes d ON d.id = cg.dish_id
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.complement_groups cg
    JOIN public.dishes d ON d.id = cg.dish_id
    JOIN public.restaurants r ON r.id = d.restaurant_id
    WHERE cg.id = complements.group_id
      AND r.user_id = auth.uid()
  )
);

-- 4) updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_complement_groups_updated_at ON public.complement_groups;
CREATE TRIGGER update_complement_groups_updated_at
BEFORE UPDATE ON public.complement_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_complements_updated_at ON public.complements;
CREATE TRIGGER update_complements_updated_at
BEFORE UPDATE ON public.complements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Extend the import function to handle complement groups and complements from JSON
CREATE OR REPLACE FUNCTION public.import_restaurant_from_json(p_payload jsonb, p_cuisine text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_restaurant_id restaurants.id%TYPE;
  v_rest_name text := p_payload->>'name';
  v_rest_image text := p_payload->>'image';
  v_rest_desc text := p_payload->>'welcome_message';
  v_cuisine text := coalesce(p_cuisine, null);

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
  -- 1) Ensure restaurant
  SELECT id INTO v_restaurant_id
  FROM restaurants
  WHERE name = v_rest_name
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO restaurants (name, cuisine_type, image_url, description)
    VALUES (v_rest_name, v_cuisine, v_rest_image, v_rest_desc)
    RETURNING id INTO v_restaurant_id;
  ELSE
    UPDATE restaurants
      SET image_url = v_rest_image,
          description = v_rest_desc,
          cuisine_type = coalesce(v_cuisine, cuisine_type),
          updated_at = now()
    WHERE id = v_restaurant_id;
  END IF;

  -- 2) Create categories
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

  -- 3) Featured names temp table
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

  -- 4) Upsert dishes and their complements
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

      -- Ensure category
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

      -- Upsert dish and get its id
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

      -- Rebuild complement groups for this dish from JSON
      IF v_dish_id IS NOT NULL THEN
        DELETE FROM complement_groups WHERE dish_id = v_dish_id; -- cascades to complements

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

            -- Complements inside the group
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
