import * as React from "react";

import { Button } from "@/components/ui/button";
import type { CardDto } from "@/types";

type Props = {
  card: CardDto;
  href: string;
  onDelete: (cardId: string) => void;
};

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export const CardListItem = React.memo(function CardListItem({ card, href, onDelete }: Props) {
  return (
    <li className="rounded-lg border bg-background p-4" data-test-id={`card-item-${card.id}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <a href={href} className="block min-w-0">
            <div className="truncate font-medium">{truncate(card.front, 120)}</div>
            <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{truncate(card.back, 160)}</div>
          </a>
        </div>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => onDelete(card.id)}
          aria-label={`Usuń fiszkę: ${truncate(card.front, 40)}`}
          data-test-id={`card-delete-button-${card.id}`}
        >
          Usuń
        </Button>
      </div>
    </li>
  );
});
