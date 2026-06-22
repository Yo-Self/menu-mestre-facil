import { supabase } from "@/integrations/supabase/client";
import { getPOSCatalogCache } from "./catalogCache";
import type { CachedComplementGroup } from "./types";

export async function fetchComplementsByDish(
  dishIds: string[]
): Promise<Record<string, CachedComplementGroup[]>> {
  if (dishIds.length === 0) return {};

  const { data: links, error: linksErr } = await supabase
    .from("dish_complement_groups")
    .select(`
      dish_id,
      complement_group_id,
      position,
      complement_group:complement_groups (
        id,
        title,
        description,
        required,
        max_selections,
        preface_question,
        preface_options
      )
    `)
    .in("dish_id", dishIds)
    .order("position", { ascending: true, nullsFirst: true });

  if (linksErr) throw linksErr;
  if (!links || links.length === 0) return {};

  const groupIds = [
    ...new Set(
      links
        .map((item) => (item.complement_group as { id?: string } | null)?.id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const complementsByGroup: Record<string, CachedComplementGroup["complements"]> = {};

  if (groupIds.length > 0) {
    const { data: complements, error: compsErr } = await supabase
      .from("complements")
      .select("id, name, price, is_active, group_id, position")
      .in("group_id", groupIds)
      .eq("is_active", true)
      .order("position", { ascending: true });

    if (compsErr) throw compsErr;

    for (const comp of complements || []) {
      const groupId = comp.group_id;
      if (!complementsByGroup[groupId]) {
        complementsByGroup[groupId] = [];
      }
      complementsByGroup[groupId].push({
        id: comp.id,
        name: comp.name,
        price: Math.round((comp.price || 0) * 100),
        is_active: comp.is_active,
      });
    }
  }

  const result: Record<string, CachedComplementGroup[]> = {};

  for (const link of links) {
    const group = link.complement_group as {
      id: string;
      title: string;
      description?: string | null;
      required: boolean;
      max_selections: number;
      preface_question?: string | null;
      preface_options?: unknown;
    } | null;

    if (!group) continue;

    const dishId = link.dish_id;
    if (!result[dishId]) {
      result[dishId] = [];
    }

    result[dishId].push({
      id: group.id,
      title: group.title,
      description: group.description || undefined,
      required: group.required,
      max_selections: group.max_selections,
      preface_question: group.preface_question,
      preface_options: group.preface_options as CachedComplementGroup["preface_options"],
      complements: complementsByGroup[group.id] || [],
    });
  }

  return result;
}

async function fetchComplementsForSingleDish(dishId: string): Promise<CachedComplementGroup[]> {
  const map = await fetchComplementsByDish([dishId]);
  return map[dishId] || [];
}

export async function getComplementsForDishWithFallback(
  restaurantId: string,
  dishId: string
): Promise<{ groups: CachedComplementGroup[]; fromCache: boolean }> {
  try {
    const groups = await fetchComplementsForSingleDish(dishId);
    return { groups, fromCache: false };
  } catch {
    const catalog = await getPOSCatalogCache(restaurantId);
    const cachedGroups = catalog?.complements_by_dish?.[dishId] || [];
    return { groups: cachedGroups, fromCache: cachedGroups.length > 0 };
  }
}
