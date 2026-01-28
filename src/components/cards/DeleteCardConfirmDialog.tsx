import * as React from "react";

import { Button } from "@/components/ui/button";
import type { CardDto } from "@/types";

type Props = {
  open: boolean;
  card?: CardDto;
  isPending: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteCardConfirmDialog({ open, card, isPending, errorMessage, onCancel, onConfirm }: Props) {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Potwierdź usunięcie fiszki"
      className="w-full max-w-md rounded-lg border bg-background p-0 shadow-lg backdrop:bg-black/50"
      onCancel={(e) => {
        e.preventDefault();
        if (isPending) return;
        onCancel();
      }}
    >
      <div className="p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Usunąć fiszkę?</h2>
          <p className="text-sm text-muted-foreground">
            Tej operacji nie można cofnąć.
            {card ? (
              <>
                {" "}
                Usuwasz: <span className="font-medium text-foreground">{card.front}</span>
              </>
            ) : null}
          </p>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Anuluj
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "Usuwanie…" : "Usuń"}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
