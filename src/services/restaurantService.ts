import { supabase } from '@/integrations/supabase/client';
import { generateSlug, generateUniqueSlug } from '@/lib/utils';

export interface CreateRestaurantInput {
  name: string;
  cuisine_type: string;
  image_url: string;
  description?: string;
  slug?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address_active?: boolean;
  background_light?: string;
  background_night?: string;
}

export interface CreateRestaurantOptions {
  mode?: 'onboarding' | 'full';
  waiter_call_enabled?: boolean;
  whatsapp_phone?: string | null;
  whatsapp_enabled?: boolean;
  table_payment?: boolean;
  table_ordering?: boolean;
  online_payment?: boolean;
  min_order_value?: number;
  min_order_enabled?: boolean;
  has_tables?: boolean;
  tables_count?: number;
  table_categories?: string;
}

export async function createRestaurant(
  userId: string,
  input: CreateRestaurantInput,
  options: CreateRestaurantOptions = {}
) {
  const mode = options.mode ?? 'full';

  let slug = '';
  if (input.slug?.trim()) {
    slug = await generateUniqueSlug(generateSlug(input.slug), 'restaurants');
  } else {
    slug = await generateUniqueSlug(generateSlug(input.name), 'restaurants');
  }

  const basePayload = {
    name: input.name,
    cuisine_type: input.cuisine_type,
    image_url: input.image_url,
    description: input.description || null,
    slug,
    user_id: userId,
    background_light: input.background_light || '#ffffff',
    background_night: input.background_night || '#1a1a1a',
    address: input.address || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    address_active: input.address_active ?? false,
    open: true,
    online_ordering_enabled: true,
  };

  const fullPayload =
    mode === 'onboarding'
      ? {
          ...basePayload,
          waiter_call_enabled: false,
          whatsapp_enabled: false,
          whatsapp_phone: null,
          table_payment: false,
          table_ordering: false,
          online_payment: false,
          min_order_value: 0,
          has_tables: false,
          tables_count: 0,
          table_categories: null,
        }
      : {
          ...basePayload,
          waiter_call_enabled: options.waiter_call_enabled ?? true,
          whatsapp_phone: options.whatsapp_phone?.trim() || null,
          whatsapp_enabled: options.whatsapp_enabled ?? false,
          table_payment: options.table_payment ?? false,
          table_ordering: options.table_ordering ?? false,
          online_payment: options.online_payment ?? false,
          min_order_value: options.min_order_enabled ? (options.min_order_value ?? 0) : 0,
          has_tables: options.has_tables ?? true,
          tables_count: options.tables_count ?? 12,
          table_categories: options.table_categories ?? 'Balcão, Salão Principal, Varanda',
        };

  const { data, error } = await supabase
    .from('restaurants')
    .insert([fullPayload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserOnboardingRestaurant(userId: string) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, cuisine_type, image_url, description')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
