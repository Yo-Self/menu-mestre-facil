import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

export interface SelectedComplement {
  complement_id?: string
  name?: string
  price?: number
}

export interface OrderItemForPricing {
  dish_id: string
  quantity: number
  selected_complements: SelectedComplement[] | null
  dishes?: { name: string; price?: number } | { name: string; price?: number }[] | null
}

export interface PricedLineItem {
  quantity: number
  unitCents: number
  description: string
}

function dishNameFromRelation(
  dishes: OrderItemForPricing['dishes'],
): string {
  if (!dishes) return 'Item'
  if (Array.isArray(dishes)) return dishes[0]?.name || 'Item'
  return dishes.name || 'Item'
}

function dishPriceCentsFromRelation(
  dishes: OrderItemForPricing['dishes'],
): number | null {
  if (!dishes) return null
  const price = Array.isArray(dishes) ? dishes[0]?.price : dishes.price
  if (price === undefined || price === null) return null
  return Math.round(Number(price) * 100)
}

async function loadComplementPrices(
  supabase: SupabaseClient,
  restaurantId: string,
  dishId: string,
  complementIds: string[],
): Promise<Map<string, { name: string; priceCents: number }>> {
  const result = new Map<string, { name: string; priceCents: number }>()
  if (complementIds.length === 0) return result

  const { data: dishGroups, error: groupLinkError } = await supabase
    .from('dish_complement_groups')
    .select('complement_group_id')
    .eq('dish_id', dishId)

  if (groupLinkError) {
    console.error('Failed to load dish complement groups:', groupLinkError)
    return result
  }

  const linkedGroupIds = (dishGroups || []).map((row) => row.complement_group_id)
  if (linkedGroupIds.length === 0) return result

  const { data: groups, error: groupError } = await supabase
    .from('complement_groups')
    .select('id')
    .in('id', linkedGroupIds)
    .eq('restaurant_id', restaurantId)

  if (groupError) {
    console.error('Failed to load complement groups:', groupError)
    return result
  }

  const validGroupIds = new Set((groups || []).map((group) => group.id))
  if (validGroupIds.size === 0) return result

  const { data, error } = await supabase
    .from('complements')
    .select('id, name, price, is_active, group_id')
    .in('id', complementIds)
    .in('group_id', Array.from(validGroupIds))

  if (error) {
    console.error('Failed to load complement prices:', error)
    return result
  }

  for (const row of data || []) {
    if (!validGroupIds.has(row.group_id)) continue
    if (row.is_active === false) continue
    result.set(row.id, {
      name: row.name,
      priceCents: Math.round(Number(row.price) * 100),
    })
  }

  return result
}

/**
 * Recomputes line-item unit prices from menu data instead of trusting stored order_items prices.
 */
export async function priceOrderItemsFromMenu(
  supabase: SupabaseClient,
  restaurantId: string,
  orderItems: OrderItemForPricing[],
): Promise<{ ok: true; items: PricedLineItem[]; itemsTotalCents: number } | { ok: false; error: string }> {
  const priced: PricedLineItem[] = []
  let itemsTotalCents = 0

  for (const item of orderItems) {
    if (!item.dish_id || !item.quantity || item.quantity < 1) {
      return { ok: false, error: 'Invalid order item' }
    }

    const dishCents = dishPriceCentsFromRelation(item.dishes)
    if (dishCents === null) {
      const { data: dish, error } = await supabase
        .from('dishes')
        .select('name, price, is_available')
        .eq('id', item.dish_id)
        .eq('restaurant_id', restaurantId)
        .single()

      if (error || !dish || dish.is_available === false) {
        return { ok: false, error: 'Dish not available' }
      }

      const unitBase = Math.round(Number(dish.price) * 100)
      const complementIds = (item.selected_complements || [])
        .map((c) => c.complement_id)
        .filter((id): id is string => !!id && id !== 'unknown')

      const complementPrices = await loadComplementPrices(
        supabase,
        restaurantId,
        item.dish_id,
        complementIds,
      )

      let complementCents = 0
      for (const comp of item.selected_complements || []) {
        if (!comp.complement_id || comp.complement_id === 'unknown') {
          return { ok: false, error: 'Invalid complement on order item' }
        }
        const pricedComp = complementPrices.get(comp.complement_id)
        if (!pricedComp) {
          return { ok: false, error: 'Complement not valid for dish' }
        }
        complementCents += pricedComp.priceCents
      }

      const unitCents = unitBase + complementCents
      priced.push({
        quantity: item.quantity,
        unitCents,
        description: dish.name,
      })
      itemsTotalCents += unitCents * item.quantity
      continue
    }

    const complementIds = (item.selected_complements || [])
      .map((c) => c.complement_id)
      .filter((id): id is string => !!id && id !== 'unknown')

    const complementPrices = await loadComplementPrices(
      supabase,
      restaurantId,
      item.dish_id,
      complementIds,
    )

    let complementCents = 0
    for (const comp of item.selected_complements || []) {
      if (!comp.complement_id || comp.complement_id === 'unknown') {
        return { ok: false, error: 'Invalid complement on order item' }
      }
      const pricedComp = complementPrices.get(comp.complement_id)
      if (!pricedComp) {
        return { ok: false, error: 'Complement not valid for dish' }
      }
      complementCents += pricedComp.priceCents
    }

    const unitCents = dishCents + complementCents
    priced.push({
      quantity: item.quantity,
      unitCents,
      description: dishNameFromRelation(item.dishes),
    })
    itemsTotalCents += unitCents * item.quantity
  }

  return { ok: true, items: priced, itemsTotalCents }
}
