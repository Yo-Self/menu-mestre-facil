import {
  formatOrderItemComplementDisplayLines,
  getOrderItemComplementAnswers,
} from "@/lib/orderItemComplementDisplay";

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getItemPrefaceAnswers(item: {
  complement_group_answers?: unknown;
  preface_answers?: unknown;
}): unknown {
  return getOrderItemComplementAnswers(item);
}

export function formatPrefaceAnswerLines(item: {
  selected_complements?: unknown;
  complements?: unknown;
  complement_group_answers?: unknown;
  preface_answers?: unknown;
}): string[] {
  return formatOrderItemComplementDisplayLines(
    item.selected_complements ?? item.complements,
    getOrderItemComplementAnswers(item)
  );
}

export function formatOrderItemComplementLinesHtml(
  item: {
    selected_complements?: unknown;
    complements?: unknown;
    complement_group_answers?: unknown;
    preface_answers?: unknown;
  },
  style = "font-size: 9px; color: #555; padding-left: 5px; margin-top: 1px;"
): string {
  const lines = formatPrefaceAnswerLines(item);
  return lines
    .map((line) => `<div style="${style}">${escapeHtml(line)}</div>`)
    .join("");
}

/** @deprecated Use formatOrderItemComplementLinesHtml — mantido para compatibilidade interna. */
export function formatPrefaceAnswersHtml(
  item: {
    selected_complements?: unknown;
    complements?: unknown;
    complement_group_answers?: unknown;
    preface_answers?: unknown;
  },
  style = "font-size: 9px; color: #555; padding-left: 5px; margin-top: 1px;"
): string {
  return formatOrderItemComplementLinesHtml(item, style);
}

export function formatPrefaceAnswersKitchenHtml(item: {
  selected_complements?: unknown;
  complements?: unknown;
  complement_group_answers?: unknown;
  preface_answers?: unknown;
}): string {
  return formatOrderItemComplementLinesHtml(
    item,
    "font-size: 11px; font-weight: bold; color: #111; padding-left: 5px; margin-top: 2px;"
  );
}

export function sanitizePrintImageUrl(url: unknown): string | null {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}
