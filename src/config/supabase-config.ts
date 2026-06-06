type EnvRecord = Record<string, string | undefined>;

function readEnv(key: string): string | undefined {
  const fromImport = (import.meta.env as EnvRecord)[key];
  if (fromImport) return fromImport;
  const fromGlobal = (globalThis as EnvRecord)[key];
  if (fromGlobal) return fromGlobal;
  return undefined;
}

export function getSupabaseUrl(): string {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL') || '';
}

/** Prefer new publishable key; fall back to legacy anon JWT during migration. */
export function getSupabasePublishableKey(): string {
  return (
    readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    ''
  );
}
