/** Order fields used to detect online payment (Stripe or InfinitePay PIX). */
export type OnlinePaidOrderFields = {
  status?: string | null
  stripe_payment_intent_id?: string | null
  infinitepay_transaction_nsu?: string | null
  payment_provider?: string | null
}

export function isOrderPaidOnline(order: OnlinePaidOrderFields | null | undefined): boolean {
  if (!order) return false
  if (order.stripe_payment_intent_id) return true
  if (order.infinitepay_transaction_nsu) return true
  if (order.payment_provider === 'infinitepay' || order.payment_provider === 'stripe') {
    return order.status !== 'pending_payment' && order.status !== 'cancelled'
  }
  return false
}

export function getOnlinePaymentProviderLabel(order: OnlinePaidOrderFields | null | undefined): string | null {
  if (!isOrderPaidOnline(order)) return null
  if (order?.payment_provider === 'infinitepay' || order?.infinitepay_transaction_nsu) {
    return 'Pago PIX'
  }
  if (order?.stripe_payment_intent_id || order?.payment_provider === 'stripe') {
    return 'Stripe (Online)'
  }
  return 'Pago online'
}
