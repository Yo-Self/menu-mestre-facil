import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbPut, POS_STORES } from "./posIndexedDB";
import { fetchComplementsByDish } from "./complementsCache";
import type { POSCatalogSnapshot } from "./types";

export function buildTablesConfigFromRestaurant(rest: {
  has_tables?: boolean | null;
  tables_count?: number | null;
  table_categories?: string | null;
}): { name: string; zone: string }[] {
  const hasTables = rest.has_tables ?? true;
  if (!hasTables) {
    return [{ name: "Balcão", zone: "Balcão" }];
  }

  const count = rest.tables_count ?? 12;
  const categoriesRaw = rest.table_categories || "Balcão, Salão Principal, Varanda";
  const categoriesList = categoriesRaw.split(",").map((c) => c.trim()).filter(Boolean);
  const tablesConfig: { name: string; zone: string }[] = [];

  const hasBalcaoZone = categoriesList.some((c) => c.toLowerCase() === "balcão");
  if (hasBalcaoZone) {
    tablesConfig.push({ name: "Balcão", zone: "Balcão" });
  }

  const restCategories = categoriesList.filter((c) => c.toLowerCase() !== "balcão");
  if (restCategories.length > 0) {
    let tableIndex = 1;
    for (let i = 0; i < count; i++) {
      const zoneName = restCategories[i % restCategories.length];
      tablesConfig.push({
        name: `Mesa ${String(tableIndex).padStart(2, "0")}`,
        zone: zoneName,
      });
      tableIndex++;
    }
  } else {
    for (let i = 1; i <= count; i++) {
      tablesConfig.push({
        name: `Mesa ${String(i).padStart(2, "0")}`,
        zone: "Salão Principal",
      });
    }
  }

  return tablesConfig;
}

export async function fetchPOSCatalog(restaurantId: string): Promise<POSCatalogSnapshot> {
  const { data: rest, error: restErr } = await supabase
    .from("restaurants")
    .select("name, has_tables, tables_count, table_categories, image_url")
    .eq("id", restaurantId)
    .single();

  if (restErr) throw restErr;

  const { data: categories, error: catsErr } = await supabase
    .from("categories")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("position", { ascending: true });

  if (catsErr) throw catsErr;

  const { data: dishes, error: dishesErr } = await supabase
    .from("dishes")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("is_available", true)
    .order("name", { ascending: true });

  if (dishesErr) throw dishesErr;

  const { data: activeOrders, error: ordersErr } = await supabase
    .from("orders")
    .select("id, table_name, status, total_price, created_at")
    .eq("restaurant_id", restaurantId)
    .in("status", ["new", "in_preparation", "ready"]);

  if (ordersErr) throw ordersErr;

  const dishesInCents = (dishes || []).map((dish) => ({
    ...dish,
    price: Math.round((dish.price || 0) * 100),
  }));

  const dishIds = dishesInCents.map((dish) => dish.id as string);
  let complementsByDish: POSCatalogSnapshot["complements_by_dish"] = {};

  try {
    complementsByDish = await fetchComplementsByDish(dishIds);
  } catch (error) {
    console.warn("Não foi possível cachear complementos do cardápio:", error);
  }

  return {
    restaurant_id: restaurantId,
    restaurant_name: rest.name,
    restaurant_logo: rest.image_url || "",
    tables_config: buildTablesConfigFromRestaurant(rest),
    categories: categories || [],
    dishes: dishesInCents,
    active_orders: activeOrders || [],
    complements_by_dish: complementsByDish,
    cached_at: new Date().toISOString(),
  };
}

export async function savePOSCatalog(snapshot: POSCatalogSnapshot): Promise<void> {
  await idbPut(POS_STORES.CATALOG, snapshot);
}

export async function getPOSCatalogCache(restaurantId: string): Promise<POSCatalogSnapshot | null> {
  const snapshot = await idbGet<POSCatalogSnapshot>(POS_STORES.CATALOG, restaurantId);
  return snapshot ?? null;
}

export async function loadPOSCatalogWithFallback(
  restaurantId: string
): Promise<{ snapshot: POSCatalogSnapshot; fromCache: boolean }> {
  try {
    const snapshot = await fetchPOSCatalog(restaurantId);
    await savePOSCatalog(snapshot);
    return { snapshot, fromCache: false };
  } catch (error) {
    const cached = await getPOSCatalogCache(restaurantId);
    if (cached) {
      return { snapshot: cached, fromCache: true };
    }
    throw error;
  }
}
