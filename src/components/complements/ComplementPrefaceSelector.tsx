import type { PrefaceOption } from "@/types/complementPreface";
import { parsePrefaceOptions } from "@/types/complementPreface";
import { cn } from "@/lib/utils";

type ComplementPrefaceSelectorProps = {
  question: string;
  options: PrefaceOption[] | unknown;
  selectedAnswerId?: string;
  onChange: (answerId: string) => void;
  disabled?: boolean;
  className?: string;
};

export function ComplementPrefaceSelector({
  question,
  options,
  selectedAnswerId,
  onChange,
  disabled = false,
  className,
}: ComplementPrefaceSelectorProps) {
  const parsedOptions = parsePrefaceOptions(options);

  if (!question.trim() || parsedOptions.length < 2) {
    return null;
  }

  if (parsedOptions.length === 2) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-sm font-medium text-foreground">{question}</p>
        <div className="grid grid-cols-2 gap-2">
          {parsedOptions.map((option) => {
            const isSelected = selectedAnswerId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/40",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium text-foreground">{question}</label>
      <select
        disabled={disabled}
        value={selectedAnswerId || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Selecione uma opção
        </option>
        {parsedOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function groupHasPreface(group: {
  preface_question?: string | null;
  preface_options?: unknown;
}): boolean {
  const options = parsePrefaceOptions(group.preface_options);
  return Boolean(group.preface_question?.trim()) && options.length >= 2;
}

export function buildPrefaceAnswersPayload(
  groups: Array<{
    id: string;
    title: string;
    preface_question?: string | null;
    preface_options?: unknown;
  }>,
  answersByGroupId: Record<string, string | undefined>
) {
  return groups
    .filter((group) => groupHasPreface(group) && answersByGroupId[group.id])
    .map((group) => {
      const answerId = answersByGroupId[group.id]!;
      const options = parsePrefaceOptions(group.preface_options);
      const answer = options.find((option) => option.id === answerId);
      return {
        group_id: group.id,
        group_title: group.title,
        answer_id: answerId,
        answer_label: answer?.label || "",
      };
    });
}
