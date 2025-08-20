import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuração do Supabase - estas variáveis são definidas globalmente no config.js
const SUPABASE_URL = window.SUPABASE_URL || ''
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Cache leve em localStorage com TTL (segundos)
const TTL_SECONDS = 90
function cacheKey(key) {
  return `mmf_cache:${key}`
}
function setCache(key, data) {
  const payload = { t: Date.now(), d: data }
  try { localStorage.setItem(cacheKey(key), JSON.stringify(payload)) } catch {}
}
function getCache(key) {
  try {
    const raw = localStorage.getItem(cacheKey(key))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.t) return null
    if (Date.now() - parsed.t > TTL_SECONDS * 1000) return null
    return parsed.d
  } catch { return null }
}

export async function getRestaurants() {
  const k = 'restaurants:list'
  const cached = getCache(k)
  if (cached) return cached
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  setCache(k, data ?? [])
  return data ?? []
}

export async function getRestaurantByCuisine(cuisineType) {
  if (!cuisineType) return null
  const keyCuisine = encodeURIComponent(cuisineType)
  const k = `restaurants:cuisine:${keyCuisine}`
  const cached = getCache(k)
  if (cached) return cached
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('cuisine_type', cuisineType)
    .limit(1)
  if (error) throw error
  const row = (data && data[0]) ?? null
  setCache(k, row)
  return row
}

export async function getCategoriesByRestaurant(restaurantId) {
  if (!restaurantId) return []
  const k = `categories:restaurant:${restaurantId}`
  const cached = getCache(k)
  if (cached) return cached
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('position', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  setCache(k, data ?? [])
  return data ?? []
}

export async function getFeaturedDishes(restaurantId) {
  if (!restaurantId) return []
  const k = `dishes:featured:${restaurantId}`
  const cached = getCache(k)
  if (cached) return cached
  
  // Buscar pratos em destaque com suas categorias e posições
  const { data, error } = await supabase
    .from('dish_categories')
    .select(`
      position,
      dishes(
        *,
        category:categories(*),
        dish_categories(
          categories(*)
        )
      ),
      categories!inner(
        id,
        name,
        position
      )
    `)
    .eq('dishes.restaurant_id', restaurantId)
    .eq('dishes.is_featured', true)
    .eq('dishes.is_available', true)
    .order('categories.position', { ascending: true })
    .order('position', { ascending: true })
  if (error) throw error
  
  // Processar múltiplas categorias
  const processedData = data?.map(dc => ({
    ...dc.dishes,
    position: dc.position,
    categories: dc.dishes.dish_categories?.map(dc => dc.categories) || 
                (dc.dishes.category ? [dc.dishes.category] : [])
  })) || []
  
  // Remover duplicatas baseado no ID do prato
  const uniqueDishes = processedData.filter((dish, index, self) => 
    index === self.findIndex(d => d.id === dish.id)
  )
  
  setCache(k, uniqueDishes)
  return uniqueDishes
}

export async function getAllDishes(restaurantId) {
  if (!restaurantId) return []
  const k = `dishes:all:${restaurantId}`
  const cached = getCache(k)
  if (cached) return cached
  
  // Buscar pratos com suas categorias e posições
  const { data, error } = await supabase
    .from('dish_categories')
    .select(`
      position,
      dishes(
        *,
        category:categories(*),
        dish_categories(
          categories(*)
        )
      ),
      categories!inner(
        id,
        name,
        position
      )
    `)
    .eq('dishes.restaurant_id', restaurantId)
    .eq('dishes.is_available', true)
    .order('categories.position', { ascending: true })
    .order('position', { ascending: true })
  if (error) throw error
  
  // Processar múltiplas categorias
  const processedData = data?.map(dc => ({
    ...dc.dishes,
    position: dc.position,
    categories: dc.dishes.dish_categories?.map(dc => dc.categories) || 
                (dc.dishes.category ? [dc.dishes.category] : [])
  })) || []
  
  // Remover duplicatas baseado no ID do prato
  const uniqueDishes = processedData.filter((dish, index, self) => 
    index === self.findIndex(d => d.id === dish.id)
  )
  
  setCache(k, uniqueDishes)
  return uniqueDishes
}

export async function getDishesByCategory(categoryId) {
  if (!categoryId) return []
  const k = `dishes:category:${categoryId}`
  const cached = getCache(k)
  if (cached) return cached
  
  // Buscar pratos que têm esta categoria nas múltiplas categorias, ordenados por posição
  const { data, error } = await supabase
    .from('dish_categories')
    .select(`
      position,
      dishes(
        *,
        category:categories(*),
        dish_categories(
          categories(*)
        )
      )
    `)
    .eq('category_id', categoryId)
    .eq('dishes.is_available', true)
    .order('position', { ascending: true })
  if (error) throw error
  
  // Processar e remover duplicatas
  const dishes = data
    ?.map(dc => ({
      ...dc.dishes,
      position: dc.position,
      categories: dc.dishes.dish_categories?.map(dc => dc.categories) || 
                  (dc.dishes.category ? [dc.dishes.category] : [])
    }))
    ?.filter(dish => dish) // Remover nulls
    || []
  
  // Remover duplicatas baseado no ID do prato
  const uniqueDishes = dishes.filter((dish, index, self) => 
    index === self.findIndex(d => d.id === dish.id)
  )
  
  setCache(k, uniqueDishes)
  return uniqueDishes
}

export async function searchDishes(restaurantId, term) {
  const t = term?.trim()
  if (!t || t.length < 2) return []
  const { data, error } = await supabase
    .from('dishes')
    .select(`
      *,
      category:categories(*),
      dish_categories(
        categories(*)
      )
    `)
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .or(`name.ilike.%${t}%,description.ilike.%${t}%`)
    .order('name', { ascending: true })
  if (error) throw error
  
  // Processar múltiplas categorias
  const processedData = data?.map(dish => ({
    ...dish,
    categories: dish.dish_categories?.map(dc => dc.categories) || 
                (dish.category ? [dish.category] : [])
  })) || []
  
  return processedData
}

// Pequena ajuda utilitária
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])) }
