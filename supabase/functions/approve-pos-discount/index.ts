import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { captureEdgeException } from '../_shared/sentry.ts'
import { createServiceSupabase } from '../_shared/rateLimit.ts'
import { AuthError, isValidUuid, userOwnsRestaurant } from '../_shared/auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type DiscountType = 'fixed' | 'percent'
type AuthMethod = 'account' | 'pin'

function calculateDiscountAmount(
  subtotalCents: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (subtotalCents <= 0) return 0
  if (discountType === 'fixed') {
    return Math.min(discountValue, subtotalCents)
  }
  return Math.min(subtotalCents, Math.floor((subtotalCents * discountValue) / 10000))
}

async function verifyAccountPassword(
  authClient: ReturnType<typeof createClient>,
  email: string,
  password: string,
): Promise<boolean> {
  const { error } = await authClient.auth.signInWithPassword({ email, password })
  return !error
}

async function verifyDiscountPin(
  service: ReturnType<typeof createServiceSupabase>,
  restaurantId: string,
  pin: string,
): Promise<boolean> {
  const { data, error } = await service.rpc('verify_restaurant_discount_pin', {
    p_restaurant_id: restaurantId,
    p_pin: pin,
  })

  if (error) {
    console.error('PIN verification failed:', error)
    return false
  }

  return data === true
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
    const secret = typeof body.secret === 'string'
      ? body.secret
      : typeof body.password === 'string'
        ? body.password
        : ''
    const authMethod = (body.auth_method === 'pin' ? 'pin' : 'account') as AuthMethod
    const discountType = body.discount_type as DiscountType
    const discountValue = Number(body.discount_value)
    const subtotalCents = Number(body.subtotal_cents)

    if (!isValidUuid(restaurantId)) {
      return new Response(JSON.stringify({ error: 'restaurant_id inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!secret) {
      return new Response(JSON.stringify({ error: 'Senha ou PIN obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (discountType !== 'fixed' && discountType !== 'percent') {
      return new Response(JSON.stringify({ error: 'Tipo de desconto inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return new Response(JSON.stringify({ error: 'Valor de desconto inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
      return new Response(JSON.stringify({ error: 'Subtotal inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ownsRestaurant = await userOwnsRestaurant(user.id, restaurantId)
    if (!ownsRestaurant) {
      throw new AuthError('Acesso negado ao restaurante', 403)
    }

    const service = createServiceSupabase()
    let authorized = false

    if (authMethod === 'pin') {
      authorized = await verifyDiscountPin(service, restaurantId, secret.trim())
      if (!authorized) {
        return new Response(JSON.stringify({ error: 'PIN incorreto ou não configurado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      authorized = await verifyAccountPassword(authClient, user.email, secret)
      if (!authorized) {
        return new Response(JSON.stringify({ error: 'Senha da conta incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const discountAmount = calculateDiscountAmount(subtotalCents, discountType, discountValue)

    const { data: approval, error: insertError } = await service
      .from('pos_discount_approvals')
      .insert({
        restaurant_id: restaurantId,
        user_id: user.id,
        discount_type: discountType,
        discount_value: Math.round(discountValue),
        discount_amount: discountAmount,
        subtotal_at_approval: subtotalCents,
      })
      .select('id, discount_amount, discount_type, discount_value')
      .single()

    if (insertError || !approval) {
      console.error('Failed to create discount approval:', insertError)
      return new Response(JSON.stringify({ error: 'Erro ao registrar aprovação' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        approval_id: approval.id,
        discount_amount: approval.discount_amount,
        discount_type: approval.discount_type,
        discount_value: approval.discount_value,
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

    await captureEdgeException(error, { functionName: 'approve-pos-discount' })
    return new Response(JSON.stringify({ error: 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
