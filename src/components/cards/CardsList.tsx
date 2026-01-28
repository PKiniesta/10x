import * as React from "react";

import type { CardDto } from "@/types";

import { CardListItem } from "@/components/cards/CardListItem.tsx";

type Props = {
  cards: CardDto[];
  onDelete: (cardId: string) => void;
  getCardHref: (cardId: string) => string;
};

export function CardsList({ cards, onDelete, getCardHref }: Props) {
  return (
    <ul className="space-y-2" aria-label="Lista wyników">
      {cards.map((card) => (
        <CardListItem key={card.id} card={card} onDelete={onDelete} href={getCardHref(card.id)} />
      ))}
    </ul>
  );
}
