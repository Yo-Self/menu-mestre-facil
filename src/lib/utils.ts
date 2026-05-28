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

export async function checkSlugExists(slug: string, table: 'profiles' | 'restaurants', excludeId?: string): Promise<boolean> {
  try {
    let query = supabase
      .from(table)
      .select('slug')
      .eq('slug', slug);
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data, error } = await query;

    if (error) {
      console.error('Erro ao verificar slug:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Erro ao verificar slug:', error);
    return false;
  }
}

export async function generateUniqueSlug(baseSlug: string, table: 'profiles' | 'restaurants', excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (await checkSlugExists(slug, table, excludeId)) {
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

// ─── Reports helpers ──────────────────────────────────────────────────────────

export type ReportPreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'prevMonth' | 'ytd' | 'custom';

export function getPresetRange(preset: ReportPreset): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last7':
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisMonth':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'prevMonth': {
      const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setTime(new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime());
      start.setHours(0, 0, 0, 0);
      end.setTime(firstOfThisMonth.getTime() - 1);
      break;
    }
    case 'ytd':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

/** Returns the equivalent prior period (same length, immediately before). */
export function getPrevPeriodRange(start: Date, end: Date): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart, end: prevEnd };
}

export function formatCurrencyBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function calcPercentChange(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

