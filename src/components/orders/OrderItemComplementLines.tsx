import {
  formatOrderItemComplementDisplayLines,
  getOrderItemComplementAnswers,
} from "@/lib/orderItemComplementDisplay";
import { cn } from "@/lib/utils";

type OrderItemComplementLinesProps = {
  selectedComplements?: unknown;
  complementGroupAnswers?: unknown;
  className?: string;
  lineClassName?: string;
};

export function OrderItemComplementLines({
  selectedComplements,
  complementGroupAnswers,
  className,
  lineClassName,
}: OrderItemComplementLinesProps) {
  const lines = formatOrderItemComplementDisplayLines(
    selectedComplements,
    complementGroupAnswers ?? []
  );

  if (lines.length === 0) return null;

  return (
    <div className={cn("space-y-0.5", className)}>
      {lines.map((line, index) => (
        <div key={index} className={lineClassName}>
          {line}
        </div>
      ))}
    </div>
  );
}

export function getItemComplementLinesFromOrderItem(item: {
  selected_complements?: unknown;
  complement_group_answers?: unknown;
}) {
  return formatOrderItemComplementDisplayLines(
    item.selected_complements,
    getOrderItemComplementAnswers(item)
  );
}
