import * as React from "react";

type Props = {
  cardId: string;
};

export default function CardDetailsPage({ cardId }: Props) {
  return (
    <section aria-label="Szczegóły fiszki" className="space-y-4">
      <h1 className="text-2xl font-semibold">Szczegóły fiszki</h1>
      <p className="text-sm text-muted-foreground">ID: {cardId}</p>
      <p className="text-sm text-muted-foreground">Widok w trakcie implementacji.</p>
    </section>
  );
}
