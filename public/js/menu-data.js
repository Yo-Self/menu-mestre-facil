import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const SUPABASE_URL = 'https://wulazaggdihidadkhilg.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bGF6YWdnZGloaWRhZGtoaWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0NzkxODQsImV4cCI6MjA3MDA1NTE4NH0.MxXnFZAUoMPCy9LJFTWv_6-X_8AmLr553wrAhoeRrOQ'

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
  const { data, error } = await supabase
    .from('dishes')
    .select('*, category:categories(*)')
    .eq('restaurant_id', restaurantId)
    .eq('is_featured', true)
    .eq('is_available', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  setCache(k, data ?? [])
  return data ?? []
}

export async function getAllDishes(restaurantId) {
  if (!restaurantId) return []
  const k = `dishes:all:${restaurantId}`
  const cached = getCache(k)
  if (cached) return cached
  const { data, error } = await supabase
    .from('dishes')
    .select('*, category:categories(*)')
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .order('category_id', { ascending: true })
  if (error) throw error
  setCache(k, data ?? [])
  return data ?? []
}

export async function getDishesByCategory(categoryId) {
  if (!categoryId) return []
  const k = `dishes:category:${categoryId}`
  const cached = getCache(k)
  if (cached) return cached
  const { data, error } = await supabase
    .from('dishes')
    .select('*, category:categories(*)')
    .eq('category_id', categoryId)
    .eq('is_available', true)
    .order('name', { ascending: true })
  if (error) throw error
  setCache(k, data ?? [])
  return data ?? []
}

export async function searchDishes(restaurantId, term) {
  const t = term?.trim()
  if (!t || t.length < 2) return []
  const { data, error } = await supabase
    .from('dishes')
    .select('*, category:categories(*)')
    .eq('restaurant_id', restaurantId)
    .eq('is_available', true)
    .or(`name.ilike.%${t}%,description.ilike.%${t}%`)
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Pequena ajuda utilitária
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])) }
