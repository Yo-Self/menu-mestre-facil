import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Função para aguardar as variáveis de configuração estarem disponíveis
function waitForConfig() {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo
    
    const checkConfig = () => {
      attempts++;
      
      if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
        resolve();
      } else if (attempts >= maxAttempts) {
        console.error('Timeout ao aguardar configuração Supabase');
        resolve(); // Resolver mesmo com erro para não travar
      } else {
        setTimeout(checkConfig, 100);
      }
    };
    
    // Verificar imediatamente primeiro
    checkConfig();
  });
}

// Configuração do Supabase - estas variáveis são definidas globalmente no config.js
let supabase = null;

// Inicializar o cliente Supabase quando as configurações estiverem disponíveis
async function initSupabase() {
  if (!supabase) {
    await waitForConfig();
    
    const SUPABASE_URL = window.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Configuração Supabase incompleta');
    }
    
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
      console.error('Erro ao criar cliente Supabase:', error);
      throw error;
    }
  }
  return supabase;
}

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

async function fetchDishesPublic(client, { restaurantId, dishIds, featured, search } = {}) {
  if (Array.isArray(dishIds) && dishIds.length === 0 && !restaurantId && !featured && !search) {
    return []
  }

  let query = client.from('dishes_public').select('*')

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId)
  }
  if (dishIds?.length) {
    query = query.in('id', dishIds)
  }
  if (featured) {
    query = query.eq('is_featured', true)
  }
  if (search) {
    const term = search.trim()
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

async function fetchDishCategoryLinks(client, { dishIds, categoryId } = {}) {
  let query = client
    .from('dish_categories')
    .select('dish_id, category_id, position, categories(*)')

  if (dishIds?.length) {
    query = query.in('dish_id', dishIds)
  }
  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

function groupLinksByDish(links) {
  const map = new Map()
  for (const link of links) {
    if (!map.has(link.dish_id)) {
      map.set(link.dish_id, [])
    }
    map.get(link.dish_id).push(link)
  }
  return map
}

function enrichDish(dish, links = [], position = null) {
  const categories = links.map((link) => link.categories).filter(Boolean)
  return {
    ...dish,
    ...(position != null ? { position } : {}),
    categories,
  }
}

function dedupeDishes(dishes) {
  return dishes.filter((dish, index, self) =>
    index === self.findIndex((item) => item.id === dish.id)
  )
}

function sortLinksByCategoryOrder(links, categories) {
  const categoryOrder = new Map(
    categories.map((category, index) => [category.id, category.position ?? index])
  )

  return [...links].sort((a, b) => {
    const categoryPositionA = categoryOrder.get(a.category_id) ?? 999
    const categoryPositionB = categoryOrder.get(b.category_id) ?? 999
    if (categoryPositionA !== categoryPositionB) {
      return categoryPositionA - categoryPositionB
    }
    return (a.position ?? 0) - (b.position ?? 0)
  })
}

function buildDishesFromLinks(dishMap, links, linksByDish) {
  return links
    .map((link) => {
      const dish = dishMap.get(link.dish_id)
      if (!dish) return null
      return enrichDish(dish, linksByDish.get(link.dish_id) ?? [], link.position)
    })
    .filter(Boolean)
}

export async function getRestaurants() {
  const k = 'restaurants:list'
  const cached = getCache(k)
  if (cached) return cached
  
  const client = await initSupabase();
  const { data, error } = await client
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
  
  const client = await initSupabase();
  const { data, error } = await client
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
  
  const client = await initSupabase();
  const { data, error } = await client
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
  const k = `dishes_public:featured:${restaurantId}`
  const cached = getCache(k)
  if (cached) return cached

  const client = await initSupabase()
  const [categories, dishes] = await Promise.all([
    getCategoriesByRestaurant(restaurantId),
    fetchDishesPublic(client, { restaurantId, featured: true }),
  ])

  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]))
  const links = await fetchDishCategoryLinks(client, { dishIds: dishes.map((dish) => dish.id) })
  const linksByDish = groupLinksByDish(links)
  const sortedLinks = sortLinksByCategoryOrder(links, categories)
  const uniqueDishes = dedupeDishes(buildDishesFromLinks(dishMap, sortedLinks, linksByDish))

  setCache(k, uniqueDishes)
  return uniqueDishes
}

export async function getAllDishes(restaurantId) {
  if (!restaurantId) return []
  const k = `dishes_public:all:${restaurantId}`
  const cached = getCache(k)
  if (cached) return cached

  const client = await initSupabase()
  const [categories, dishes] = await Promise.all([
    getCategoriesByRestaurant(restaurantId),
    fetchDishesPublic(client, { restaurantId }),
  ])

  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]))
  const links = await fetchDishCategoryLinks(client, { dishIds: dishes.map((dish) => dish.id) })
  const linksByDish = groupLinksByDish(links)
  const sortedLinks = sortLinksByCategoryOrder(links, categories)
  const uniqueDishes = dedupeDishes(buildDishesFromLinks(dishMap, sortedLinks, linksByDish))

  setCache(k, uniqueDishes)
  return uniqueDishes
}

export async function getDishesByCategory(categoryId) {
  if (!categoryId) return []
  const k = `dishes_public:category:${categoryId}`
  const cached = getCache(k)
  if (cached) return cached

  const client = await initSupabase()
  const categoryLinks = await fetchDishCategoryLinks(client, { categoryId })
  if (categoryLinks.length === 0) {
    setCache(k, [])
    return []
  }

  categoryLinks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const dishIds = categoryLinks.map((link) => link.dish_id)
  const dishes = await fetchDishesPublic(client, { dishIds })
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]))
  const allLinks = await fetchDishCategoryLinks(client, { dishIds })
  const linksByDish = groupLinksByDish(allLinks)
  const uniqueDishes = dedupeDishes(buildDishesFromLinks(dishMap, categoryLinks, linksByDish))

  setCache(k, uniqueDishes)
  return uniqueDishes
}

export async function searchDishes(restaurantId, term) {
  const t = term?.trim()
  if (!t || t.length < 2) return []

  const client = await initSupabase()
  const dishes = await fetchDishesPublic(client, { restaurantId, search: t })
  const links = await fetchDishCategoryLinks(client, { dishIds: dishes.map((dish) => dish.id) })
  const linksByDish = groupLinksByDish(links)

  return dishes.map((dish) => enrichDish(dish, linksByDish.get(dish.id) ?? []))
}

// Pequena ajuda utilitária
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])) }
