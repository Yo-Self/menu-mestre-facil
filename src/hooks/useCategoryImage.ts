import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseCategoryImageProps {
  categoryId: string;
  categoryImageUrl: string | null;
}

export function useCategoryImage({ categoryId, categoryImageUrl }: UseCategoryImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(categoryImageUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Se a categoria já tem uma imagem, use ela
    if (categoryImageUrl) {
      setImageUrl(categoryImageUrl);
      return;
    }

    // Se não tem imagem, busque a imagem do primeiro prato
    if (categoryId) {
      fetchFirstDishImage();
    }
  }, [categoryId, categoryImageUrl]);

  const fetchFirstDishImage = async () => {
    if (!categoryId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('dish_categories')
        .select(`
          dishes!inner (
            id,
            image_url
          )
        `)
        .eq('category_id', categoryId)
        .order('position', { ascending: true })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0 && data[0].dishes) {
        const firstDish = data[0].dishes;
        if (firstDish.image_url) {
          setImageUrl(firstDish.image_url);
        }
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao buscar imagem do primeiro prato:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageError = () => {
    // Se a imagem da categoria falhou ao carregar, tente buscar a imagem do primeiro prato
    if (categoryImageUrl && imageUrl === categoryImageUrl) {
      fetchFirstDishImage();
    }
  };

  return {
    imageUrl,
    isLoading,
    error,
    handleImageError,
    refetch: fetchFirstDishImage
  };
}
