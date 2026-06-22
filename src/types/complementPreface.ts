export type PrefaceOption = {
  id: string;
  label: string;
  position: number;
};

export function parsePrefaceOptions(raw: unknown): PrefaceOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : crypto.randomUUID();
      const label = typeof record.label === "string" ? record.label : "";
      const position = typeof record.position === "number" ? record.position : index;
      return { id, label, position };
    })
    .filter((item): item is PrefaceOption => item !== null)
    .sort((a, b) => a.position - b.position);
}

export function validatePrefaceFields(
  enabled: boolean,
  question: string,
  options: PrefaceOption[]
): string | null {
  if (!enabled) return null;
  if (!question.trim()) return "Informe o texto da pergunta.";
  const labels = options.map((o) => o.label.trim()).filter(Boolean);
  if (labels.length < 2) return "Adicione pelo menos 2 opções de resposta.";
  if (labels.length > 8) return "Máximo de 8 opções de resposta.";
  return null;
}

export function buildPrefaceDbFields(
  enabled: boolean,
  question: string,
  options: PrefaceOption[]
): { preface_question: string | null; preface_options: PrefaceOption[] | null } {
  if (!enabled) {
    return { preface_question: null, preface_options: null };
  }
  const normalized = options
    .map((option, index) => ({
      id: option.id || crypto.randomUUID(),
      label: option.label.trim(),
      position: index,
    }))
    .filter((option) => option.label.length > 0);
  return {
    preface_question: question.trim(),
    preface_options: normalized,
  };
}

export function createEmptyPrefaceOptions(count = 2): PrefaceOption[] {
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    label: "",
    position: index,
  }));
}
