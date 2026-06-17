import { globalConfig } from './global-config';

export const config = {
  supabase: {
    url: globalConfig.supabase.url,
    anonKey: globalConfig.supabase.anonKey,
  },
};

export const validateConfig = () => {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
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
