import { globalConfig } from './global-config';

export const config = {
  supabase: {
    url: globalConfig.supabase.url,
    anonKey: globalConfig.supabase.anonKey,
  },
};

export const validateConfig = () => {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missingVars = requiredVars.filter(
    () => !globalConfig.supabase.url || !globalConfig.supabase.anonKey
  );

  if (missingVars.length > 0) {
    console.warn(
      `Missing environment variables: ${missingVars.join(', ')}`
    );
  }
};
