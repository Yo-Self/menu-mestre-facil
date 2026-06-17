type EnvRecord = Record<string, string | undefined>;

function readEnv(key: string): string | undefined {
  const fromImport = (import.meta.env as EnvRecord)[key];
  if (fromImport) return fromImport;
  const fromGlobal = (globalThis as EnvRecord)[key];
  if (fromGlobal) return fromGlobal;
  return undefined;
}

function assertHttpsInProduction(url: string): string {
  if (!url || !import.meta.env.PROD) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Supabase URL must use HTTPS in production.');
  }

  return url;
}

export function getSupabaseUrl(): string {
  const url =
    readEnv('VITE_SUPABASE_URL') ||
    readEnv('NEXT_PUBLIC_SUPABASE_URL') ||
    '';

  return assertHttpsInProduction(url);
}

/** Prefer new publishable key; fall back to legacy anon JWT during migration. */
export function getSupabasePublishableKey(): string {
  return (
    readEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    readEnv('VITE_SUPABASE_ANON_KEY') ||
    readEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    ''
  );
}
