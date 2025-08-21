import { useCategoryImage } from '@/hooks/useCategoryImage';

interface CategoryImageProps {
  categoryId: string;
  categoryImageUrl: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function CategoryImage({ 
  categoryId, 
  categoryImageUrl, 
  alt, 
  className = "",
  fallbackClassName = ""
}: CategoryImageProps) {
  const { imageUrl, isLoading, handleImageError } = useCategoryImage({
    categoryId,
    categoryImageUrl
  });

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-muted ${className}`}>
        <div className="w-full h-full bg-muted-foreground/20" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className}`}>
        <div className={`text-muted-foreground text-center ${fallbackClassName}`}>
          <svg
            className="w-8 h-8 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-xs">Sem imagem</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={handleImageError}
      loading="lazy"
    />
  );
}
