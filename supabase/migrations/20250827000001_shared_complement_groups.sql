-- Migration: Allow complement groups to be shared across multiple dishes
-- This creates a many-to-many relationship between dishes and complement groups

BEGIN;

-- Step 1: Add restaurant_id to complement_groups for ownership and management
-- This allows managing complement groups independently of dishes
ALTER TABLE complement_groups 
ADD COLUMN restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE;

-- Step 2: Create junction table for many-to-many relationship
CREATE TABLE dish_complement_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dish_id UUID NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    complement_group_id UUID NOT NULL REFERENCES complement_groups(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure no duplicate relationships
    UNIQUE(dish_id, complement_group_id)
);

-- Step 3: Migrate existing data
-- First, populate restaurant_id in complement_groups based on current dish relationships
UPDATE complement_groups 
SET restaurant_id = (
    SELECT restaurant_id 
    FROM dishes 
    WHERE dishes.id = complement_groups.dish_id
);

-- Make restaurant_id required after data migration
ALTER TABLE complement_groups 
ALTER COLUMN restaurant_id SET NOT NULL;

-- Step 4: Migrate existing relationships to the new junction table
INSERT INTO dish_complement_groups (dish_id, complement_group_id, position)
SELECT 
    cg.dish_id,
    cg.id,
    COALESCE(cg.position, 0)
FROM complement_groups cg
WHERE cg.dish_id IS NOT NULL;

-- Step 5: Drop existing policies that depend on dish_id
DROP POLICY IF EXISTS "Restaurant owners can manage their complement groups" ON complement_groups;
DROP POLICY IF EXISTS "Users can manage complement groups for their dishes" ON complement_groups;

-- Also drop dependent policies on complements table
DROP POLICY IF EXISTS "Restaurant owners can manage their complements" ON complements;
DROP POLICY IF EXISTS "Users can manage complements for their dishes" ON complements;

-- Step 6: Remove the old direct relationship
ALTER TABLE complement_groups 
DROP COLUMN dish_id,
DROP COLUMN position; -- position now managed in junction table

-- Step 7: Enable RLS on new table
ALTER TABLE dish_complement_groups ENABLE ROW LEVEL SECURITY;

-- Step 8: Add RLS policies for dish_complement_groups
-- Users can only manage relationships for their own restaurants
CREATE POLICY "Users can view own restaurant dish-complement relationships" 
ON dish_complement_groups FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM dishes d 
        JOIN restaurants r ON d.restaurant_id = r.id 
        WHERE d.id = dish_complement_groups.dish_id 
        AND r.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert own restaurant dish-complement relationships" 
ON dish_complement_groups FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM dishes d 
        JOIN restaurants r ON d.restaurant_id = r.id 
        WHERE d.id = dish_complement_groups.dish_id 
        AND r.user_id = auth.uid()
    )
    AND
    EXISTS (
        SELECT 1 FROM complement_groups cg 
        JOIN restaurants r ON cg.restaurant_id = r.id 
        WHERE cg.id = dish_complement_groups.complement_group_id 
        AND r.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update own restaurant dish-complement relationships" 
ON dish_complement_groups FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM dishes d 
        JOIN restaurants r ON d.restaurant_id = r.id 
        WHERE d.id = dish_complement_groups.dish_id 
        AND r.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete own restaurant dish-complement relationships" 
ON dish_complement_groups FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM dishes d 
        JOIN restaurants r ON d.restaurant_id = r.id 
        WHERE d.id = dish_complement_groups.dish_id 
        AND r.user_id = auth.uid()
    )
);

-- Step 9: Update RLS policies for complement_groups to use restaurant_id
DROP POLICY IF EXISTS "Users can view own restaurant complement groups" ON complement_groups;
DROP POLICY IF EXISTS "Users can insert own restaurant complement groups" ON complement_groups;
DROP POLICY IF EXISTS "Users can update own restaurant complement groups" ON complement_groups;
DROP POLICY IF EXISTS "Users can delete own restaurant complement groups" ON complement_groups;

CREATE POLICY "Users can view own restaurant complement groups" 
ON complement_groups FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE restaurants.id = complement_groups.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert own restaurant complement groups" 
ON complement_groups FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE restaurants.id = complement_groups.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update own restaurant complement groups" 
ON complement_groups FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE restaurants.id = complement_groups.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete own restaurant complement groups" 
ON complement_groups FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM restaurants 
        WHERE restaurants.id = complement_groups.restaurant_id 
        AND restaurants.user_id = auth.uid()
    )
);

-- Step 10: Add indexes for performance
CREATE INDEX idx_dish_complement_groups_dish_id ON dish_complement_groups(dish_id);
CREATE INDEX idx_dish_complement_groups_complement_group_id ON dish_complement_groups(complement_group_id);
CREATE INDEX idx_complement_groups_restaurant_id ON complement_groups(restaurant_id);

-- Step 11: Add comments for documentation
COMMENT ON TABLE dish_complement_groups IS 'Junction table enabling many-to-many relationship between dishes and complement groups';
COMMENT ON TABLE complement_groups IS 'Complement groups that can be shared across multiple dishes within a restaurant';
COMMENT ON COLUMN complement_groups.restaurant_id IS 'Restaurant that owns this complement group - enables independent management';

COMMIT;
