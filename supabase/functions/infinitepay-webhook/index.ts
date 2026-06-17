import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { captureEdgeException } from '../_shared/sentry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-signature',
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

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left.length !== right.length) return false
  let mismatch = 0
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return mismatch === 0
}

/** InfinitePay/WooCommerce plugin: HMAC-SHA256(hex) of raw body with shared secret. */
async function verifyCallbackSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader?.trim()) return false

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expectedHex = bytesToHex(new Uint8Array(digest))

  return timingSafeEqualHex(expectedHex, signatureHeader.trim())
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
    const webhookSecret = Deno.env.get('INFINITEPAY_WEBHOOK_SECRET')?.trim()

    if (webhookSecret) {
      const signature = req.headers.get('X-Callback-Signature')
      const valid = await verifyCallbackSignature(rawBody, signature, webhookSecret)
      if (!valid) {
        console.error('InfinitePay webhook rejected: invalid or missing X-Callback-Signature')
        return jsonResponse({ error: 'Invalid webhook signature' }, 401)
      }
    }

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
      .select('id, status, total_price, infinitepay_invoice_slug, payment_provider')
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

    const storedSlug = typeof order.infinitepay_invoice_slug === 'string'
      ? order.infinitepay_invoice_slug
      : null

    if (!storedSlug) {
      console.error('InfinitePay webhook rejected: order has no checkout invoice slug', orderId)
      return jsonResponse({ error: 'Order not linked to InfinitePay checkout' }, 400)
    }

    if (!invoiceSlug || invoiceSlug !== storedSlug) {
      console.error('InfinitePay webhook rejected: invoice_slug mismatch', {
        orderId,
        expected: storedSlug,
        received: invoiceSlug ?? null,
      })
      return jsonResponse({ error: 'Invoice slug mismatch' }, 400)
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
    await captureEdgeException(error, {
      functionName: 'infinitepay-webhook',
      extra: { path: req.url, method: req.method },
    })
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
