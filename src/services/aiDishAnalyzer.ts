import { supabase } from '@/integrations/supabase/client';

export interface DishAnalysisResult {
  name: string;
  description: string;
  category: string;
  suggested_price: number;
  confidence: number;
}

export interface AnalyzeDishContext {
  cuisine_type?: string;
  existing_categories?: string[];
}

export async function analyzeDishImage(
  imageUrl: string,
  context: AnalyzeDishContext = {}
): Promise<DishAnalysisResult | null> {
  const startedAt = Date.now();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.functions.invoke('ai-analyze-dish', {
      body: {
        image_url: imageUrl,
        cuisine_type: context.cuisine_type,
        existing_categories: context.existing_categories,
        distinct_id: user?.id,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const result = data?.result as DishAnalysisResult;
    return result ?? null;
  } catch (error) {
    console.error('Falha na análise de prato:', error);
    return null;
  } finally {
    const latencyMs = Date.now() - startedAt;
    void latencyMs;
  }
}
