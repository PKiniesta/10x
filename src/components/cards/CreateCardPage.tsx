import * as React from "react";
import { CardForm } from "./CardForm";
import { createCard, type ApiError } from "@/lib/services/cards.api";
import { type CreateManualCardInput } from "@/lib/validation/cards";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CreateCardPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (data: CreateManualCardInput) => {
    setIsLoading(true);
    setError(null);

    try {
      await createCard(data);
      globalThis.location.href = "/cards";
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError?.message || "Wystąpił błąd podczas tworzenia fiszki. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Nowa fiszka</h1>
        <p className="text-muted-foreground">Utwórz nową fiszkę ręcznie, wpisując treść na obie strony.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dane fiszki</CardTitle>
          <CardDescription>Pamiętaj o limitach znaków dla każdej ze stron.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <CardForm onSubmit={handleSubmit} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
