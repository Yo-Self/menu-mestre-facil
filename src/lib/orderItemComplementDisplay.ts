export type OrderItemComplementEntry = {
  name?: string | null;
  group_title?: string | null;
};

export type OrderItemPrefaceAnswerEntry = {
  group_title?: string | null;
  answer_label?: string | null;
};

/**
 * Formata complementos + respostas de pergunta prévia para exibição/impressão.
 *
 * Grupo com preface: "Acompanhamentos - Misturado: Amendoim, Granola"
 * Grupo/complemento sem preface: "+ Calda de chocolate"
 */
export function formatOrderItemComplementDisplayLines(
  selectedComplements: unknown,
  complementGroupAnswers: unknown
): string[] {
  const complements = (Array.isArray(selectedComplements) ? selectedComplements : [])
    .map((entry) => {
      const item = entry as OrderItemComplementEntry;
      return {
        name: item.name?.trim() ?? "",
        groupTitle: item.group_title?.trim() ?? "",
      };
    })
    .filter((item) => item.name.length > 0);

  const answers = (Array.isArray(complementGroupAnswers) ? complementGroupAnswers : [])
    .map((entry) => {
      const item = entry as OrderItemPrefaceAnswerEntry;
      return {
        groupTitle: item.group_title?.trim() ?? "",
        answerLabel: item.answer_label?.trim() ?? "",
      };
    })
    .filter((item) => item.groupTitle.length > 0 && item.answerLabel.length > 0);

  const answerByTitle = new Map(answers.map((a) => [a.groupTitle, a.answerLabel]));
  const grouped = new Map<string, string[]>();
  const ungrouped: string[] = [];

  for (const comp of complements) {
    if (comp.groupTitle) {
      const list = grouped.get(comp.groupTitle) ?? [];
      list.push(comp.name);
      grouped.set(comp.groupTitle, list);
    } else {
      ungrouped.push(comp.name);
    }
  }

  const lines: string[] = [];
  const handledTitles = new Set<string>();

  for (const [title, names] of grouped) {
    handledTitles.add(title);
    const answerLabel = answerByTitle.get(title);
    if (answerLabel) {
      lines.push(`${title} - ${answerLabel}: ${names.join(", ")}`);
    } else {
      for (const name of names) {
        lines.push(`+ ${name}`);
      }
    }
  }

  for (const { groupTitle, answerLabel } of answers) {
    if (!handledTitles.has(groupTitle)) {
      lines.push(`${groupTitle} - ${answerLabel}`);
    }
  }

  if (ungrouped.length > 0) {
    if (answers.length === 1 && grouped.size === 0) {
      const { groupTitle, answerLabel } = answers[0];
      lines.push(`${groupTitle} - ${answerLabel}: ${ungrouped.join(", ")}`);
    } else {
      for (const name of ungrouped) {
        lines.push(`+ ${name}`);
      }
    }
  }

  return lines;
}

export function getOrderItemComplementAnswers(item: {
  complement_group_answers?: unknown;
  preface_answers?: unknown;
}): unknown {
  return item.complement_group_answers ?? item.preface_answers ?? [];
}
