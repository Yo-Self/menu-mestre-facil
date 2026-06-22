import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PrefaceOption } from "@/types/complementPreface";

type ComplementGroupPrefaceEditorProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  question: string;
  onQuestionChange: (question: string) => void;
  options: PrefaceOption[];
  onOptionsChange: (options: PrefaceOption[]) => void;
  idPrefix?: string;
};

export function ComplementGroupPrefaceEditor({
  enabled,
  onEnabledChange,
  question,
  onQuestionChange,
  options,
  onOptionsChange,
  idPrefix = "preface",
}: ComplementGroupPrefaceEditorProps) {
  const updateOptionLabel = (index: number, label: string) => {
    const next = options.map((option, i) => (i === index ? { ...option, label } : option));
    onOptionsChange(next);
  };

  const addOption = () => {
    if (options.length >= 8) return;
    onOptionsChange([
      ...options,
      { id: crypto.randomUUID(), label: "", position: options.length },
    ]);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    onOptionsChange(
      options
        .filter((_, i) => i !== index)
        .map((option, i) => ({ ...option, position: i }))
    );
  };

  return (
    <div className="space-y-3 rounded-md border p-4 bg-muted/30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor={`${idPrefix}-enabled`}>Pergunta antes dos complementos</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Com 2 opções o cliente vê uma chave; com 3 ou mais, um seletor.
          </p>
        </div>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>

      {enabled && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-question`}>Pergunta</Label>
            <Input
              id={`${idPrefix}-question`}
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder='Ex: Deseja isso dentro do sorvete ou por cima?'
            />
          </div>

          <div className="space-y-2">
            <Label>Opções de resposta</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Input
                    value={option.label}
                    onChange={(e) => updateOptionLabel(index, e.target.value)}
                    placeholder={`Opção ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={options.length <= 2}
                    onClick={() => removeOption(index)}
                    aria-label="Remover opção"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={options.length >= 8}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar opção
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
