import * as React from "react";

import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  pageSize: number;
  total?: number;
  currentCount: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function PaginationControls({ page, pageSize, total, currentCount, onPageChange, disabled }: Props) {
  const canGoPrev = page > 1;
  const canGoNext = typeof total === "number" ? page * pageSize < total : currentCount === pageSize;

  return (
    <nav aria-label="Paginacja" className="flex items-center justify-between gap-3">
      <Button type="button" variant="outline" disabled={disabled || !canGoPrev} onClick={() => onPageChange(page - 1)}>
        Poprzednia
      </Button>

      <div className="text-sm text-muted-foreground">
        Strona <span className="font-medium text-foreground">{page}</span>
        {typeof total === "number" ? (
          <>
            {" "}
            Wyników: <span className="font-medium text-foreground">{total}</span>
          </>
        ) : null}
      </div>

      <Button type="button" variant="outline" disabled={disabled || !canGoNext} onClick={() => onPageChange(page + 1)}>
        Następna
      </Button>
    </nav>
  );
}
