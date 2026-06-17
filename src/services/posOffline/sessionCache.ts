import { idbGet, idbPut, POS_STORES } from "./posIndexedDB";
import type { CachedPOSSession } from "./types";
import type { POSSession } from "@/services/posService";

export async function cachePOSSession(
  restaurantId: string,
  session: POSSession
): Promise<void> {
  const record: CachedPOSSession = {
    restaurant_id: restaurantId,
    session,
    cached_at: new Date().toISOString(),
  };
  await idbPut(POS_STORES.SESSION, record);
}

export async function getCachedPOSSession(restaurantId: string): Promise<POSSession | null> {
  const record = await idbGet<CachedPOSSession>(POS_STORES.SESSION, restaurantId);
  return record?.session ?? null;
}
