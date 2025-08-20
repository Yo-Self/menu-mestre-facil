import { globalConfig } from './global-config';

export const config = {
  tinypng: {
    apiKey: globalConfig.tinypng.apiKey,
    apiUrl: 'https://api.tinify.com',
  },
  supabase: {
    url: globalConfig.supabase.url,
    anonKey: globalConfig.supabase.anonKey,
  },
};

export const validateConfig = () => {
  const requiredVars = [
    'TINYPNG_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missingVars = requiredVars.filter(
    (varName) => {
      if (varName === 'TINYPNG_API_KEY') {
        return !globalConfig.tinypng.apiKey;
      }
      return !globalConfig.supabase.url || !globalConfig.supabase.anonKey;
    }
  );

  if (missingVars.length > 0) {
    console.warn(
      `Missing environment variables: ${missingVars.join(', ')}`
    );
  }
};
