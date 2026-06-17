import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { verifyInfinitePayPayment } from '../_shared/infinitepay-payment-check.ts'
import { captureEdgeException } from '../_shared/sentry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InfinitePayWebhookPayload {
  invoice_slug?: string
  amount?: number
  paid_amount?: number
  order_nsu?: string
  transaction_nsu?: string
  capture_method?: string
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey =
      Deno.env.get('SB_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase env not configured for infinitepay-webhook')
      return jsonResponse({ error: 'Server configuration error' }, 500)
    }

    const rawBody = await req.text()

    let payload: InfinitePayWebhookPayload
    try {
      payload = JSON.parse(rawBody) as InfinitePayWebhookPayload
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const orderId = payload.order_nsu
    const transactionNsu = payload.transaction_nsu
    const invoiceSlug = payload.invoice_slug

    if (!orderId) {
      return jsonResponse({ error: 'order_nsu is required' }, 400)
    }

    if (!transactionNsu) {
      return jsonResponse({ error: 'transaction_nsu is required' }, 400)
    }

    if (!invoiceSlug) {
      return jsonResponse({ error: 'invoice_slug is required' }, 400)
    }

    const eventKey = `tx:${transactionNsu}`

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: existingEvent } = await supabase
      .from('infinitepay_webhook_events')
      .select('id')
      .eq('event_key', eventKey)
      .maybeSingle()

    if (existingEvent) {
      return jsonResponse({ received: true, duplicate: true }, 200)
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        status,
        total_price,
        infinitepay_invoice_slug,
        restaurant_id,
        restaurants ( infinitepay_handle )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order not found for InfinitePay webhook:', orderId, orderError)
      return jsonResponse({ error: 'Order not found' }, 400)
    }

    if (order.status !== 'pending_payment') {
      await supabase.from('infinitepay_webhook_events').insert({
        event_key: eventKey,
        order_nsu: orderId,
        transaction_nsu: transactionNsu,
      })
      return jsonResponse({ received: true, skipped: true }, 200)
    }

    const storedSlug = typeof order.infinitepay_invoice_slug === 'string'
      ? order.infinitepay_invoice_slug
      : null

    if (!storedSlug) {
      console.error('InfinitePay webhook rejected: order has no checkout invoice slug', orderId)
      return jsonResponse({ error: 'Order not linked to InfinitePay checkout' }, 400)
    }

    if (invoiceSlug !== storedSlug) {
      console.error('InfinitePay webhook rejected: invoice_slug mismatch', {
        orderId,
        expected: storedSlug,
        received: invoiceSlug,
      })
      return jsonResponse({ error: 'Invoice slug mismatch' }, 400)
    }

    const restaurant = order.restaurants as { infinitepay_handle?: string | null } | null
    const devHandle = Deno.env.get('INFINITEPAY_DEV_HANDLE')?.replace(/^\$/, '').trim()
    const handle = (restaurant?.infinitepay_handle || devHandle || '').replace(/^\$/, '').trim()

    if (!handle) {
      console.error('InfinitePay webhook rejected: restaurant handle not configured', orderId)
      return jsonResponse({ error: 'Restaurant InfinitePay handle not configured' }, 400)
    }

    const paymentCheck = await verifyInfinitePayPayment({
      handle,
      orderNsu: orderId,
      transactionNsu,
      slug: invoiceSlug,
    })

    if (!paymentCheck.ok) {
      console.error('InfinitePay payment_check rejected webhook:', {
        orderId,
        reason: paymentCheck.reason,
      })
      return jsonResponse({ error: 'Payment not verified with InfinitePay' }, 400)
    }

    if (paymentCheck.paidAmount < order.total_price) {
      console.error('InfinitePay verified amount too low:', {
        orderId,
        expected: order.total_price,
        verified: paymentCheck.paidAmount,
      })
      return jsonResponse({ error: 'Payment amount mismatch' }, 400)
    }

    const updateData: Record<string, unknown> = {
      status: 'new',
      payment_provider: 'infinitepay',
      infinitepay_transaction_nsu: transactionNsu,
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .eq('status', 'pending_payment')

    if (updateError) {
      console.error('Error updating order from InfinitePay webhook:', updateError)
      return jsonResponse({ error: 'Failed to update order' }, 500)
    }

    const { error: eventInsertError } = await supabase.from('infinitepay_webhook_events').insert({
      event_key: eventKey,
      order_nsu: orderId,
      transaction_nsu: transactionNsu,
    })

    if (eventInsertError) {
      console.error('Error recording InfinitePay webhook event:', eventInsertError)
    }

    const captureMethod = paymentCheck.captureMethod ?? payload.capture_method ?? 'unknown'
    console.log(`Order ${orderId} paid via InfinitePay (${captureMethod})`)

    return jsonResponse({ received: true }, 200)
  } catch (error) {
    console.error('Unexpected error in infinitepay-webhook:', error)
    await captureEdgeException(error, {
      functionName: 'infinitepay-webhook',
      extra: { path: req.url, method: req.method },
    })
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
