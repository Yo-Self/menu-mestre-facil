-- Test the new many-to-many relationship structure
SELECT 
    d.name as dish_name,
    cg.title as complement_group_title,
    cg.required,
    cg.max_selections,
    COUNT(c.id) as complement_items_count,
    r.name as restaurant_name
FROM dishes d
    JOIN dish_complement_groups dcg ON d.id = dcg.dish_id
    JOIN complement_groups cg ON dcg.complement_group_id = cg.id
    JOIN restaurants r ON cg.restaurant_id = r.id
    LEFT JOIN complements c ON cg.id = c.group_id
GROUP BY d.id, d.name, cg.id, cg.title, cg.required, cg.max_selections, r.name
ORDER BY d.name, cg.title;

-- Test: Create a second dish and share the same complement group
INSERT INTO dishes (name, description, price, image_url, restaurant_id, category_id, is_available) 
VALUES (
    'Pizza Margherita',
    'Pizza clássica com molho de tomate, mussarela e manjericão',
    35.90,
    'https://via.placeholder.com/400x300',
    (SELECT id FROM restaurants LIMIT 1),
    (SELECT id FROM categories LIMIT 1),
    true
);

-- Associate the existing complement group with the new dish
INSERT INTO dish_complement_groups (dish_id, complement_group_id, position)
VALUES (
    (SELECT id FROM dishes WHERE name = 'Pizza Margherita'),
    (SELECT id FROM complement_groups LIMIT 1),
    1
);

-- Verify both dishes now share the same complement group
SELECT 
    d.name as dish_name,
    cg.title as complement_group_title,
    string_agg(c.name, ', ') as complement_items
FROM dishes d
    JOIN dish_complement_groups dcg ON d.id = dcg.dish_id
    JOIN complement_groups cg ON dcg.complement_group_id = cg.id
    LEFT JOIN complements c ON cg.id = c.group_id
GROUP BY d.id, d.name, cg.id, cg.title
ORDER BY d.name;
