import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

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

    const payload = await req.json() as InfinitePayWebhookPayload
    const orderId = payload.order_nsu
    const transactionNsu = payload.transaction_nsu
    const invoiceSlug = payload.invoice_slug

    if (!orderId) {
      return jsonResponse({ error: 'order_nsu is required' }, 400)
    }

    const eventKey = transactionNsu
      ? `tx:${transactionNsu}`
      : invoiceSlug
        ? `slug:${invoiceSlug}`
        : `order:${orderId}:${payload.paid_amount ?? payload.amount ?? 'unknown'}`

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
      .select('id, status, total_price')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order not found for InfinitePay webhook:', orderId, orderError)
      return jsonResponse({ error: 'Order not found' }, 500)
    }

    if (order.status !== 'pending_payment') {
      await supabase.from('infinitepay_webhook_events').insert({
        event_key: eventKey,
        order_nsu: orderId,
        transaction_nsu: transactionNsu ?? null,
      })
      return jsonResponse({ received: true, skipped: true }, 200)
    }

    const paidAmount = typeof payload.paid_amount === 'number'
      ? payload.paid_amount
      : typeof payload.amount === 'number'
        ? payload.amount
        : null

    if (paidAmount === null) {
      console.error('InfinitePay webhook missing amount:', orderId)
      return jsonResponse({ error: 'Missing payment amount' }, 400)
    }

    if (paidAmount < order.total_price) {
      console.error('InfinitePay payment amount too low:', {
        orderId,
        expected: order.total_price,
        received: paidAmount,
      })
      return jsonResponse({ error: 'Payment amount mismatch' }, 400)
    }

    const updateData: Record<string, unknown> = {
      status: 'new',
      payment_provider: 'infinitepay',
    }
    if (transactionNsu) updateData.infinitepay_transaction_nsu = transactionNsu
    if (invoiceSlug) updateData.infinitepay_invoice_slug = invoiceSlug

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
      transaction_nsu: transactionNsu ?? null,
    })

    if (eventInsertError) {
      console.error('Error recording InfinitePay webhook event:', eventInsertError)
    }

    console.log(`Order ${orderId} paid via InfinitePay (${payload.capture_method ?? 'unknown'})`)

    return jsonResponse({ received: true }, 200)
  } catch (error) {
    console.error('Unexpected error in infinitepay-webhook:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
