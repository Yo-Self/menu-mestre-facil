import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from "@/integrations/supabase/client"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateSlug(input: string): string {
  const withoutDiacritics = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const lowerKebab = withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return lowerKebab || "item";
}

export async function checkSlugExists(slug: string, table: 'profiles' | 'restaurants'): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('slug')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return !!data;
  } catch (error) {
    console.error('Erro ao verificar slug:', error);
    return false;
  }
}

export async function generateUniqueSlug(baseSlug: string, table: 'profiles' | 'restaurants'): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await checkSlugExists(slug, table)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

export function generateRestaurantUrl(organizationSlug: string, restaurantSlug: string): string {
  return `/${organizationSlug}/${restaurantSlug}`;
}

export function generateOrganizationUrl(organizationSlug: string): string {
  return `/${organizationSlug}`;
}

export function generatePublicMenuUrl(organizationSlug: string, restaurantSlug: string): string {
  return `/menu/${organizationSlug}/${restaurantSlug}`;
}
