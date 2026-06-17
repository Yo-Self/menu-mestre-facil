import { useCallback, useRef, useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_FILES = 20;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'];

interface BulkImageDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  currentCount?: number;
}

export function BulkImageDropzone({
  onFilesSelected,
  disabled,
  currentCount = 0,
}: BulkImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;

      const remaining = MAX_FILES - currentCount;
      const files = Array.from(fileList)
        .filter((f) => ACCEPTED_TYPES.includes(f.type))
        .slice(0, remaining);

      if (files.length > 0) {
        onFilesSelected(files);
      }
    },
    [onFilesSelected, disabled, currentCount]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
        isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        {isDragging ? (
          <Upload className="h-6 w-6 text-primary" />
        ) : (
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      <p className="mt-4 text-sm font-medium">
        Arraste fotos dos pratos ou clique para selecionar
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Até {MAX_FILES} fotos · JPEG, PNG ou WebP
        {currentCount > 0 && ` · ${currentCount}/${MAX_FILES} adicionadas`}
      </p>
    </div>
  );
}
