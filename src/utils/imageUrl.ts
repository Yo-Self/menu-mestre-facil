const SUPABASE_IMAGE_PATH =
  /^(https?:\/\/[^/]+\.supabase\.co)\/storage\/v1\/(?:object|render\/image)\/public\/images\/([^?]+)/;

const UNSPLASH_PLACEHOLDERS: Record<string, string> = {
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80',
  hamburguer: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80',
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80',
  salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80',
  salada: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80',
  pasta: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80',
  massa: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80',
  risoto: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&q=80',
  risotto: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&q=80',
  dessert: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80',
  sobremesa: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&q=80',
  coffee: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80',
  cafe: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80',
  steak: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80',
  carne: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80',
  couvert: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&q=80',
};

function getPlaceholderByPath(path: string): string {
  const lowercasePath = path.toLowerCase();
  for (const key of Object.keys(UNSPLASH_PLACEHOLDERS)) {
    if (lowercasePath.includes(key)) {
      return UNSPLASH_PLACEHOLDERS[key];
    }
  }
  return UNSPLASH_PLACEHOLDERS.default;
}

export interface ImageUrlOptions {
  /** Use the raw stored URL (e.g. print/export). Skips dev unsplash rewrite. */
  raw?: boolean;
}

/** Supabase Image Transformations require Pro+. Enable with NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM=true */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number = 400,
  options?: ImageUrlOptions
): string {
  if (!url) return '';

  if (options?.raw) return url;

  const match = url.match(SUPABASE_IMAGE_PATH);
  if (!match) return url;

  const [, origin, path] = match;

  if (import.meta.env.DEV) {
    const devImageMode =
      (import.meta.env as Record<string, string | undefined>).NEXT_PUBLIC_DEV_IMAGE_MODE ||
      'unsplash-fallback';

    if (devImageMode === 'unsplash-fallback') {
      return `${getPlaceholderByPath(path)}&w=${width}`;
    }

    if (devImageMode === 'local-storage') {
      const env = import.meta.env as Record<string, string | undefined>;
      const localSupabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
      if (localSupabaseUrl) {
        return `${localSupabaseUrl}/storage/v1/object/public/images/${path}`;
      }
    }
  }

  if (
    (import.meta.env as Record<string, string | undefined>).NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM ===
    'true'
  ) {
    return `${origin}/storage/v1/render/image/public/images/${path}?width=${width}&quality=80&resize=contain`;
  }

  return `${origin}/storage/v1/object/public/images/${path}`;
}

export function isSupabaseStorageUrl(url: string): boolean {
  return SUPABASE_IMAGE_PATH.test(url);
}
