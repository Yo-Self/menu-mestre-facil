import { getOptimizedImageUrl, type ImageUrlOptions } from '@/utils/imageUrl';

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined;
  width?: number;
  imageOptions?: ImageUrlOptions;
}

export function OptimizedImage({
  src,
  width = 400,
  imageOptions,
  alt = '',
  loading = 'lazy',
  decoding = 'async',
  ...props
}: OptimizedImageProps) {
  const resolvedSrc = getOptimizedImageUrl(src, width, imageOptions);

  if (!resolvedSrc) {
    return null;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      {...props}
    />
  );
}
