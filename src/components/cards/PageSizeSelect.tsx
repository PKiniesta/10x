import * as React from "react";

import type { CardsQueryState } from "@/components/hooks/useCardsQueryState";

type Props = {
  value: CardsQueryState["pageSize"];
  onChange: (value: CardsQueryState["pageSize"]) => void;
  disabled?: boolean;
};

export function PageSizeSelect({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground" htmlFor="cards-page-size">
        Na stronę
      </label>
      <select
        id="cards-page-size"
        className="h-9 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const next = e.currentTarget.value;
          if (next === "20") return onChange(20);
          if (next === "30") return onChange(30);
          if (next === "50") return onChange(50);
        }}
      >
        <option value="20">20</option>
        <option value="30">30</option>
        <option value="50">50</option>
      </select>
    </div>
  );
}
