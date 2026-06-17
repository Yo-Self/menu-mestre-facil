/**
 * Official InfinitePay payment verification.
 * @see https://www.infinitepay.io/checkout-documentacao
 * POST https://api.checkout.infinitepay.io/payment_check
 */

const PAYMENT_CHECK_ENDPOINTS = [
  'https://api.checkout.infinitepay.io/payment_check',
  'https://api.infinitepay.io/invoices/public/checkout/payment_check',
]

export interface InfinitePayPaymentCheckResponse {
  success?: boolean
  paid?: boolean
  amount?: number
  paid_amount?: number
  installments?: number
  capture_method?: string
}

export async function verifyInfinitePayPayment(params: {
  handle: string
  orderNsu: string
  transactionNsu: string
  slug: string
}): Promise<
  | { ok: true; paidAmount: number; captureMethod?: string }
  | { ok: false; reason: string }
> {
  const handle = params.handle.replace(/^\$/, '').trim()
  if (!handle) {
    return { ok: false, reason: 'missing_handle' }
  }

  const body = {
    handle,
    order_nsu: params.orderNsu,
    transaction_nsu: params.transactionNsu,
    slug: params.slug,
  }

  let lastReason = 'payment_check_unreachable'

  for (const endpoint of PAYMENT_CHECK_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({})) as InfinitePayPaymentCheckResponse

      if (!response.ok) {
        lastReason = `payment_check_http_${response.status}`
        console.error('InfinitePay payment_check failed:', endpoint, response.status, data)
        continue
      }

      if (data.success !== true || data.paid !== true) {
        return { ok: false, reason: 'payment_not_confirmed' }
      }

      const paidAmount = typeof data.paid_amount === 'number'
        ? data.paid_amount
        : typeof data.amount === 'number'
          ? data.amount
          : null

      if (paidAmount === null) {
        return { ok: false, reason: 'payment_check_missing_amount' }
      }

      return {
        ok: true,
        paidAmount,
        captureMethod: typeof data.capture_method === 'string' ? data.capture_method : undefined,
      }
    } catch (err) {
      lastReason = err instanceof Error ? err.message : 'payment_check_error'
      console.error('InfinitePay payment_check request failed:', endpoint, lastReason)
    }
  }

  return { ok: false, reason: lastReason }
}
