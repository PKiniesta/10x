import * as React from "react";
import { getCard, updateCard, deleteCard, type ApiError } from "@/lib/services/cards.api";
import { type CardDto } from "@/types";
import { CardForm } from "./CardForm";
import { DeleteCardConfirmDialog } from "./DeleteCardConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type CreateManualCardInput } from "@/lib/validation/cards";

type Props = {
  cardId: string;
};

export default function CardDetailsPage({ cardId }: Props) {
  const [card, setCard] = React.useState<CardDto | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string>();

  const fetchCard = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCard(cardId);
      setCard(data);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      if (apiError.status === 404) {
        setError("Fiszka nie została znaleziona.");
      } else {
        setError(apiError.message || "Wystąpił błąd podczas pobierania fiszki.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  React.useEffect(() => {
    fetchCard();
  }, [fetchCard]);

  const handleUpdate = async (data: CreateManualCardInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const updated = await updateCard(cardId, data);
      setCard(updated);
      setIsEditing(false);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.message || "Wystąpił błąd podczas aktualizacji fiszki.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(undefined);
    try {
      await deleteCard(cardId);
      globalThis.location.href = "/cards";
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setDeleteError(apiError.message || "Wystąpił błąd podczas usuwania fiszki.");
      setIsDeleting(false);
    }
  };

  if (isLoading && !card) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  if (error && !card) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => (globalThis.location.href = "/cards")}>Wróć do listy</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!card) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Szczegóły fiszki</h1>
          <p className="text-muted-foreground">{isEditing ? "Edytujesz fiszkę" : "Podgląd treści fiszki"}</p>
        </div>
        {!isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edytuj
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              Usuń
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edytuj fiszkę</CardTitle>
            <CardDescription>Wprowadź zmiany i zapisz je, aby zaktualizować fiszkę.</CardDescription>
          </CardHeader>
          <CardContent>
            <CardForm
              onSubmit={handleUpdate}
              isLoading={isLoading}
              defaultValues={{ front: card.front, back: card.back }}
              onCancel={() => setIsEditing(false)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Awers (Front)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-lg">{card.front}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rewers (Back)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-lg">{card.back}</p>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground px-1">
            <p>Metoda utworzenia: {card.origin === "manual" ? "Ręcznie" : "AI"}</p>
            <p>Utworzono: {new Date(card.createdAt).toLocaleString("pl-PL")}</p>
            {card.updatedAt !== card.createdAt && (
              <p>Ostatnia zmiana: {new Date(card.updatedAt).toLocaleString("pl-PL")}</p>
            )}
          </div>
        </div>
      )}

      <DeleteCardConfirmDialog
        open={showDeleteDialog}
        card={card}
        isPending={isDeleting}
        errorMessage={deleteError}
        onCancel={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
