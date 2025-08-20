export const config = {
  tinypng: {
    apiKey: import.meta.env.TINYPNG_API_KEY || '',
    apiUrl: 'https://api.tinify.com',
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
};

export const validateConfig = () => {
  const requiredVars = [
    'TINYPNG_API_KEY',
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
  ];

  const missingVars = requiredVars.filter(
    (varName) => {
      if (varName === 'TINYPNG_API_KEY') {
        return !import.meta.env.TINYPNG_API_KEY;
      }
      return !import.meta.env[varName];
    }
  );

  if (missingVars.length > 0) {
    console.warn(
      `Missing environment variables: ${missingVars.join(', ')}`
    );
  }
};
