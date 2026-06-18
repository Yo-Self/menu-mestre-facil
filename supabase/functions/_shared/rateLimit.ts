import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

export function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown'
}

export function createServiceSupabase(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function enforceRateLimit(
  supabase: SupabaseClient,
  scope: string,
  identifier: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<Response | null> {
  const { data: allowed, error } = await supabase.rpc('check_edge_function_rate_limit', {
    p_scope: scope,
    p_identifier: identifier,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  })

  if (error) {
    console.error(`Rate limit check failed (${scope}):`, error)
    return null
  }

  if (allowed !== true) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return null
}
