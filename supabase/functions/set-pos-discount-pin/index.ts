import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { captureEdgeException } from '../_shared/sentry.ts'
import { createServiceSupabase } from '../_shared/rateLimit.ts'
import { AuthError, isValidUuid, userOwnsRestaurant } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function isValidPin(pin: string): boolean {
  return /^[0-9]{4,6}$/.test(pin)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthError('Autenticação obrigatória', 401)
    }

    const token = authHeader.split(' ')[1]
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authClient = createClient(supabaseUrl, supabaseAnonKey)

    const { data: { user }, error: userError } = await authClient.auth.getUser(token)
    if (userError || !user?.email) {
      throw new AuthError('Autenticação obrigatória', 401)
    }

    const body = await req.json()
    const restaurantId = body.restaurant_id
    const accountPassword = typeof body.account_password === 'string' ? body.account_password : ''
    const pin = typeof body.pin === 'string' ? body.pin.trim() : null
    const removePin = body.remove_pin === true

    if (!isValidUuid(restaurantId)) {
      return new Response(JSON.stringify({ error: 'restaurant_id inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!accountPassword) {
      return new Response(JSON.stringify({ error: 'Senha da conta obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ownsRestaurant = await userOwnsRestaurant(user.id, restaurantId)
    if (!ownsRestaurant) {
      throw new AuthError('Acesso negado ao restaurante', 403)
    }

    const { error: signInError } = await authClient.auth.signInWithPassword({
      email: user.email,
      password: accountPassword,
    })

    if (signInError) {
      return new Response(JSON.stringify({ error: 'Senha da conta incorreta' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!removePin && pin && !isValidPin(pin)) {
      return new Response(JSON.stringify({ error: 'PIN deve ter 4 a 6 dígitos numéricos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const service = createServiceSupabase()
    const { error: applyError } = await service.rpc('apply_restaurant_discount_pin', {
      p_restaurant_id: restaurantId,
      p_user_id: user.id,
      p_pin: removePin ? null : pin,
    })

    if (applyError) {
      console.error('Failed to apply discount PIN:', applyError)
      const message = applyError.message?.includes('invalid_pin')
        ? 'PIN deve ter 4 a 6 dígitos numéricos'
        : 'Erro ao salvar PIN'
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        pin_enabled: !removePin && !!pin,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await captureEdgeException(error, { functionName: 'set-pos-discount-pin' })
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
