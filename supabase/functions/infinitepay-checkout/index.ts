import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INFINITEPAY_LINK_ENDPOINTS = [
  'https://api.infinitepay.io/invoices/public/checkout/links',
  'https://api.checkout.infinitepay.io/links',
]

/** InfinitePay rejects orders with total <= R$ 1,00 (100 centavos). */
const INFINITEPAY_MIN_TOTAL_CENTS = 100

interface CheckoutRequest {
  order_id: string
  restaurant_id: string
  success_url: string
  cancel_url?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
}

interface OrderItemRow {
  quantity: number
  price_at_time_of_order: number
  selected_complements: { name?: string; price?: number }[] | null
  dishes: { name: string } | { name: string }[] | null
}

interface CheckoutItem {
  quantity: number
  price: number
  description: string
}

interface ValidatedInfinitePayCheckout {
  items: CheckoutItem[]
  totalAmountCents: number
  handle: string
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function dishNameFromRelation(dishes: OrderItemRow['dishes']): string {
  if (!dishes) return 'Item'
  if (Array.isArray(dishes)) return dishes[0]?.name || 'Item'
  return dishes.name || 'Item'
}

function complementTotal(complements: OrderItemRow['selected_complements']): number {
  if (!complements || !Array.isArray(complements)) return 0
  return complements.reduce((sum, c) => sum + (Number(c.price) || 0), 0)
}

function normalizePhoneE164(phone: string | undefined): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 10) return undefined
  if (digits.startsWith('55')) return `+${digits}`
  return `+55${digits}`
}

function extractCheckoutUrl(data: Record<string, unknown>): string | null {
  const candidates = [data.url, data.checkout_url, data.link]
  for (const value of candidates) {
    if (typeof value === 'string' && value.startsWith('http')) return value
  }
  return null
}

async function loadAndValidateCheckout(
  supabase: SupabaseClient,
  orderId: string,
  restaurantId: string,
): Promise<{ ok: true; data: ValidatedInfinitePayCheckout } | { ok: false; response: Response }> {
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('infinitepay_handle, pix_payment_enabled, open, is_open_for_orders')
    .eq('id', restaurantId)
    .single()

  if (restaurantError || !restaurant) {
    return { ok: false, response: jsonResponse({ error: 'Restaurant not found' }, 404) }
  }

  const devHandle = Deno.env.get('INFINITEPAY_DEV_HANDLE')?.replace(/^\$/, '').trim()
  const pixEnabled = restaurant.pix_payment_enabled === true || !!devHandle
  if (!pixEnabled) {
    return { ok: false, response: jsonResponse({ error: 'PIX payment is not enabled for this restaurant' }, 403) }
  }

  const handle = (restaurant.infinitepay_handle || devHandle || '').replace(/^\$/, '').trim()
  if (!handle) {
    return { ok: false, response: jsonResponse({ error: 'InfinitePay handle is not configured' }, 403) }
  }

  if (!restaurant.open || !restaurant.is_open_for_orders) {
    return { ok: false, response: jsonResponse({ error: 'Restaurant is not accepting orders' }, 403) }
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      restaurant_id,
      status,
      total_price,
      delivery_fee,
      order_items (
        quantity,
        price_at_time_of_order,
        selected_complements,
        dishes ( name )
      )
    `)
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return { ok: false, response: jsonResponse({ error: 'Order not found' }, 404) }
  }

  if (order.restaurant_id !== restaurantId) {
    return { ok: false, response: jsonResponse({ error: 'Order does not belong to this restaurant' }, 403) }
  }

  if (order.status !== 'pending_payment') {
    return { ok: false, response: jsonResponse({ error: 'Order is not awaiting payment' }, 409) }
  }

  const orderItems = (order.order_items || []) as OrderItemRow[]
  if (orderItems.length === 0) {
    return { ok: false, response: jsonResponse({ error: 'Order has no items' }, 400) }
  }

  const items: CheckoutItem[] = orderItems.map((item) => {
    const unitCents = item.price_at_time_of_order + complementTotal(item.selected_complements)
    return {
      quantity: item.quantity,
      price: unitCents,
      description: dishNameFromRelation(item.dishes),
    }
  })

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const deliveryFee = Number(order.delivery_fee) || 0

  if (deliveryFee > 0) {
    items.push({
      quantity: 1,
      price: deliveryFee,
      description: 'Taxa de Entrega',
    })
  }

  const computedTotal = itemsTotal + deliveryFee
  if (computedTotal !== order.total_price) {
    console.error('Order total mismatch:', { orderId, computedTotal, storedTotal: order.total_price })
    return { ok: false, response: jsonResponse({ error: 'Order total validation failed' }, 400) }
  }

  return {
    ok: true,
    data: {
      items,
      totalAmountCents: order.total_price,
      handle,
    },
  }
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown'
}

async function enforceRateLimits(
  supabase: SupabaseClient,
  orderId: string,
  clientIp: string,
): Promise<Response | null> {
  const { data: ipAllowed, error: ipError } = await supabase.rpc('check_edge_function_rate_limit', {
    p_scope: 'infinitepay-checkout:ip',
    p_identifier: clientIp,
    p_max_requests: 30,
    p_window_seconds: 60,
  })

  if (ipError) {
    console.error('Rate limit check failed (ip):', ipError)
  } else if (ipAllowed !== true) {
    return jsonResponse({ error: 'Too many requests. Please try again later.' }, 429)
  }

  const { data: orderAllowed, error: orderError } = await supabase.rpc('check_edge_function_rate_limit', {
    p_scope: 'infinitepay-checkout:order',
    p_identifier: orderId,
    p_max_requests: 5,
    p_window_seconds: 300,
  })

  if (orderError) {
    console.error('Rate limit check failed (order):', orderError)
  } else if (orderAllowed !== true) {
    return jsonResponse({ error: 'Too many checkout attempts for this order.' }, 429)
  }

  return null
}

function formatInfinitePayError(data: Record<string, unknown>): string {
  const message = typeof data.message === 'string' ? data.message : ''
  const errors = data.errors as Record<string, unknown> | undefined

  if (errors && typeof errors === 'object') {
    const items = errors.items
    if (Array.isArray(items) && items.length > 0) {
      const first = String(items[0])
      if (first.toLowerCase().includes('greater than 1')) {
        return 'O valor mínimo para pagamento via InfinitePay é R$ 1,00.'
      }
      return first
    }
  }

  if (message.toLowerCase().includes('invalid checkout')) {
    return 'Parâmetros inválidos para o checkout InfinitePay. Verifique o valor do pedido (mínimo R$ 1,00).'
  }

  return message || JSON.stringify(data)
}

async function createInfinitePayLink(
  payload: Record<string, unknown>,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; details: string; status: number }> {
  let lastError = 'Erro desconhecido na InfinitePay'
  let lastStatus = 502

  for (const endpoint of INFINITEPAY_LINK_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({})) as Record<string, unknown>

      if (response.ok) {
        return { ok: true, data }
      }

      lastStatus = response.status === 422 ? 400 : 502
      lastError = formatInfinitePayError(data)
      console.error(`InfinitePay API error (${endpoint}):`, response.status, lastError)
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error(`InfinitePay request failed (${endpoint}):`, lastError)
    }
  }

  return { ok: false, details: lastError, status: lastStatus }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const body: CheckoutRequest = await req.json()
    const {
      order_id,
      restaurant_id,
      success_url,
      customer_name,
      customer_phone,
      customer_email,
    } = body

    if (!order_id) {
      return jsonResponse({ error: 'order_id is required' }, 400)
    }
    if (!restaurant_id) {
      return jsonResponse({ error: 'restaurant_id is required' }, 400)
    }
    if (!success_url) {
      return jsonResponse({ error: 'success_url is required' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey =
      Deno.env.get('SB_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: 'Server configuration error' }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const rateLimitResponse = await enforceRateLimits(supabase, order_id, getClientIp(req))
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const validation = await loadAndValidateCheckout(supabase, order_id, restaurant_id)
    if (!validation.ok) {
      return validation.response
    }

    const { items, handle, totalAmountCents } = validation.data

    if (totalAmountCents < INFINITEPAY_MIN_TOTAL_CENTS) {
      return jsonResponse({
        error: 'Order total below InfinitePay minimum',
        details: 'O valor mínimo para pagamento via InfinitePay é R$ 1,00.',
      }, 400)
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/infinitepay-webhook`

    const payload: Record<string, unknown> = {
      handle,
      items,
      itens: items,
      order_nsu: order_id,
      redirect_url: success_url,
      webhook_url: webhookUrl,
    }

    const phone = normalizePhoneE164(customer_phone)
    if (customer_name || customer_email || phone) {
      payload.customer = {
        ...(customer_name ? { name: customer_name } : {}),
        ...(customer_email ? { email: customer_email } : {}),
        ...(phone ? { phone_number: phone } : {}),
      }
    }

    const linkResult = await createInfinitePayLink(payload)
    if (!linkResult.ok) {
      return jsonResponse({
        error: 'Failed to create InfinitePay checkout link',
        details: linkResult.details,
      }, linkResult.status)
    }

    const checkoutUrl = extractCheckoutUrl(linkResult.data)
    if (!checkoutUrl) {
      console.error('InfinitePay response missing checkout URL:', JSON.stringify(linkResult.data))
      return jsonResponse({ error: 'Checkout URL not returned by InfinitePay' }, 502)
    }

    const invoiceSlug = typeof linkResult.data.slug === 'string' ? linkResult.data.slug : null

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_provider: 'infinitepay',
        ...(invoiceSlug ? { infinitepay_invoice_slug: invoiceSlug } : {}),
      })
      .eq('id', order_id)
      .eq('status', 'pending_payment')

    if (updateError) {
      console.error('Error updating order with InfinitePay metadata:', updateError)
    }

    return jsonResponse({ checkout_url: checkoutUrl, slug: invoiceSlug }, 200)
  } catch (error) {
    console.error('Unexpected error in infinitepay-checkout:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
