import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { Loader2, Trash2, Sparkles } from 'lucide-react';
import type { DishDraft } from '@/services/menuOnboardingService';
import { OptimizedImage } from '@/components/ui/optimized-image';

interface DishDraftCardProps {
  draft: DishDraft;
  categories: string[];
  onChange: (id: string, updates: Partial<DishDraft>) => void;
  onRemove: (id: string) => void;
}

export function DishDraftCard({
  draft,
  categories,
  onChange,
  onRemove,
}: DishDraftCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative w-full sm:w-40 flex-shrink-0">
            {draft.imageUrl ? (
              <div className="relative w-full h-32 rounded-lg overflow-hidden bg-muted">
                <OptimizedImage
                  src={draft.imageUrl}
                  alt={draft.name || 'Prato'}
                  className="w-full h-full object-cover"
                />
                {draft.analyzing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
            ) : (
              <ImageUpload
                label="Foto do prato"
                value={draft.imageUrl}
                onChange={(url) => onChange(draft.id, { imageUrl: url })}
              />
            )}
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                {draft.analyzing
                  ? 'Analisando com IA...'
                  : draft.analyzeError
                    ? 'Preencha manualmente'
                    : 'Sugestão da IA — revise antes de salvar'}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => onRemove(draft.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nome do prato *</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => onChange(draft.id, { name: e.target.value })}
                  placeholder="Ex: Feijoada Completa"
                  disabled={draft.analyzing}
                />
              </div>
              <div>
                <Label>Preço (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.price}
                  onChange={(e) => onChange(draft.id, { price: e.target.value })}
                  placeholder="0,00"
                  disabled={draft.analyzing}
                />
              </div>
            </div>

            <div>
              <Label>Categoria</Label>
              <Input
                value={draft.category}
                onChange={(e) => onChange(draft.id, { category: e.target.value })}
                placeholder="Ex: Pratos Principais"
                list={`categories-${draft.id}`}
                disabled={draft.analyzing}
              />
              <datalist id={`categories-${draft.id}`}>
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => onChange(draft.id, { description: e.target.value })}
                placeholder="Descreva os ingredientes e acompanhamentos..."
                rows={2}
                disabled={draft.analyzing}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
