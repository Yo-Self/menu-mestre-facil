import { supabase } from '@/integrations/supabase/client';

export interface DishDraft {
  id: string;
  imageUrl: string;
  name: string;
  description: string;
  category: string;
  price: string;
  analyzing?: boolean;
  analyzeError?: string;
}

export interface SaveMenuDraftsInput {
  restaurantId: string;
  drafts: DishDraft[];
}

export async function getRestaurantDishesCount(restaurantId: string): Promise<number> {
  const { count, error } = await supabase
    .from('dishes')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId);

  if (error) throw error;
  return count ?? 0;
}

export async function saveMenuDrafts({ restaurantId, drafts }: SaveMenuDraftsInput) {
  const validDrafts = drafts.filter(
    (d) => d.name.trim() && d.price && parseFloat(d.price) > 0 && d.imageUrl
  );

  if (validDrafts.length === 0) {
    throw new Error('Adicione pelo menos um prato válido com nome, preço e foto');
  }

  const categoryNames = [...new Set(validDrafts.map((d) => d.category.trim() || 'Geral'))];
  const categoryMap = new Map<string, string>();

  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        name,
        restaurant_id: restaurantId,
        position: i,
      })
      .select('id')
      .single();

    if (error) throw error;
    categoryMap.set(name, category.id);
  }

  const dishesToInsert = validDrafts.map((draft) => {
    const categoryName = draft.category.trim() || 'Geral';
    const categoryId = categoryMap.get(categoryName)!;
    return {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price: parseFloat(draft.price),
      image_url: draft.imageUrl,
      restaurant_id: restaurantId,
      category_id: categoryId,
      is_available: true,
      needs_preparation: true,
      is_featured: false,
    };
  });

  const { data: dishes, error: dishesError } = await supabase
    .from('dishes')
    .insert(dishesToInsert)
    .select('id, category_id');

  if (dishesError) throw dishesError;

  const dishCategories = (dishes || []).map((dish, index) => ({
    dish_id: dish.id,
    category_id: dish.category_id!,
    position: index,
  }));

  if (dishCategories.length > 0) {
    const { error: junctionError } = await supabase
      .from('dish_categories')
      .insert(dishCategories);

    if (junctionError) throw junctionError;
  }

  return {
    categoriesCount: categoryNames.length,
    dishesCount: dishes?.length ?? 0,
  };
}
