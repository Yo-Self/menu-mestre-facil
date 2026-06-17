import { supabase } from "@/integrations/supabase/client";

const CONNECTIVITY_TIMEOUT_MS = 5000;

export type ConnectivityStatus = "online" | "degraded" | "offline";

export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);

  const normalized = message.toLowerCase();
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const businessErrors = [
    "pos_session_not_open",
    "invalid_payload",
    "invalid_items",
    "forbidden",
    "permission denied",
    "violates",
    "duplicate key",
  ];

  if (businessErrors.some((fragment) => normalized.includes(fragment))) {
    return false;
  }

  return (
    normalized.includes("fetch") ||
    normalized.includes("network") ||
    normalized.includes("timeout") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("aborterror") ||
    normalized.includes("load failed") ||
    normalized.includes("connectivity_timeout") ||
    code === "PGRST301" ||
    code === "PGRST000" ||
    code === "57014"
  );
}

export async function checkSupabaseConnectivity(): Promise<boolean> {
  if (!navigator.onLine) return false;

  try {
    const check = supabase.from("restaurants").select("id").limit(1);
    const result = await Promise.race([
      check,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("connectivity_timeout")), CONNECTIVITY_TIMEOUT_MS)
      ),
    ]);

    return !result.error;
  } catch {
    return false;
  }
}

export async function resolveConnectivityStatus(): Promise<ConnectivityStatus> {
  if (!navigator.onLine) return "offline";

  const reachable = await checkSupabaseConnectivity();
  return reachable ? "online" : "degraded";
}
