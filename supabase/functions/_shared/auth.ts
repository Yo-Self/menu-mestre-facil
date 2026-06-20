import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { createServiceSupabase } from './rateLimit.ts'

export class AuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export async function requireRestaurantOwner(req: Request): Promise<{ userId: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Autenticação obrigatória', 401)
  }

  const token = authHeader.split(' ')[1]
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    throw new AuthError('Autenticação obrigatória', 401)
  }

  if (user.is_anonymous === true) {
    throw new AuthError('Acesso restrito a gestores de restaurante', 403)
  }

  const service = createServiceSupabase()
  const { data: restaurant, error: restaurantError } = await service
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (restaurantError || !restaurant) {
    throw new AuthError('Acesso restrito a gestores de restaurante', 403)
  }

  return { userId: user.id }
}

export async function requireAuthenticatedUser(req: Request): Promise<{ userId: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Autenticação obrigatória', 401)
  }

  const token = authHeader.split(' ')[1]
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    throw new AuthError('Autenticação obrigatória', 401)
  }

  if (user.is_anonymous === true) {
    throw new AuthError('Autenticação de usuário obrigatória', 403)
  }

  return { userId: user.id }
}

export async function userOwnsRestaurant(userId: string, restaurantId: string): Promise<boolean> {
  const service = createServiceSupabase()
  const { data, error } = await service
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('user_id', userId)
    .maybeSingle()

  return !error && !!data
}

export async function getUserFromRequest(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.split(' ')[1]
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return null
  }

  return { userId: user.id }
}

export function isValidUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
