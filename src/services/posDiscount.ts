import { supabase } from '@/integrations/supabase/client'

export type POSDiscountType = 'fixed' | 'percent'
export type POSDiscountAuthMethod = 'account' | 'pin'

export interface POSDiscountState {
  type: POSDiscountType
  value: number
  amount: number
  approvalId: string
}

export function calculateDiscountPreview(
  subtotalCents: number,
  discountType: POSDiscountType,
  discountValue: number,
): number {
  if (subtotalCents <= 0 || discountValue <= 0) return 0
  if (discountType === 'fixed') {
    return Math.min(Math.round(discountValue), subtotalCents)
  }
  return Math.min(subtotalCents, Math.floor((subtotalCents * Math.round(discountValue)) / 10000))
}

export function formatDiscountLabel(type: POSDiscountType, value: number): string {
  if (type === 'percent') {
    return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`
  }
  return `R$ ${(value / 100).toFixed(2)}`
}

export interface RequestDiscountApprovalInput {
  restaurantId: string
  secret: string
  authMethod: POSDiscountAuthMethod
  discountType: POSDiscountType
  discountValue: number
  subtotalCents: number
}

export interface RequestDiscountApprovalResult {
  approvalId: string
  discountAmount: number
  discountType: POSDiscountType
  discountValue: number
}

export interface SetDiscountPinInput {
  restaurantId: string
  accountPassword: string
  pin?: string
  removePin?: boolean
}

export async function requestDiscountApproval(
  input: RequestDiscountApprovalInput,
): Promise<RequestDiscountApprovalResult> {
  const { data, error } = await supabase.functions.invoke('approve-pos-discount', {
    body: {
      restaurant_id: input.restaurantId,
      auth_method: input.authMethod,
      secret: input.secret,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      subtotal_cents: input.subtotalCents,
    },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao aprovar desconto')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (!data?.approval_id) {
    throw new Error('Resposta inválida ao aprovar desconto')
  }

  return {
    approvalId: data.approval_id,
    discountAmount: data.discount_amount,
    discountType: data.discount_type,
    discountValue: data.discount_value,
  }
}

export async function setRestaurantDiscountPin(
  input: SetDiscountPinInput,
): Promise<{ pinEnabled: boolean }> {
  const { data, error } = await supabase.functions.invoke('set-pos-discount-pin', {
    body: {
      restaurant_id: input.restaurantId,
      account_password: input.accountPassword,
      pin: input.removePin ? null : input.pin,
      remove_pin: input.removePin ?? false,
    },
  })

  if (error) {
    throw new Error(error.message || 'Erro ao configurar PIN')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return { pinEnabled: !!data?.pin_enabled }
}

export async function fetchDiscountPinEnabled(restaurantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('pos_discount_pin_enabled')
    .eq('id', restaurantId)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch discount PIN status:', error)
    return false
  }

  return !!data?.pos_discount_pin_enabled
}
