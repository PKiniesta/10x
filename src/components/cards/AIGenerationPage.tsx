import * as React from "react";
import { AIGenerationForm } from "./AIGenerationForm";
import { getTodayLimits, startGeneration } from "@/lib/services/ai.api";
import { type TodayLimitsDto, type StartAiGenerationCommand } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AIGenerationPage() {
  const [limits, setLimits] = React.useState<TodayLimitsDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    async function fetchLimits() {
      try {
        const data = await getTodayLimits();
        setLimits(data);
      } catch (err) {
        console.error("Failed to fetch limits:", err);
      }
    }
    fetchLimits();
  }, []);

  const handleSubmit = async (data: StartAiGenerationCommand) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await startGeneration(data);
      if (response.ok) {
        // Store proposals in sessionStorage to survive potential (though not intended) refreshes
        // OR just pass state via URL if we had a proper router.
        // In Astro, we can't easily pass big state between pages via simple redirect.
        // Plan says: "Propozycje review w MVP są trzymane wyłącznie w pamięci".
        // This usually means we stay on the same page or use a global store.
        // But the plan says ścieżka /ai/review.

        sessionStorage.setItem("ai_proposals", JSON.stringify(response));
        globalThis.location.href = "/ai/review";
      } else {
        setError(response.error.message || "Błąd generowania AI.");
      }
    } catch (err: any) {
      setError(err?.message || "Wystąpił nieoczekiwany błąd.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Generowanie AI</h1>
        <p className="text-muted-foreground">Wklej tekst, a nasze AI przygotuje dla Ciebie propozycje fiszek.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Twój tekst</CardTitle>
              <CardDescription>Wprowadź fragment artykułu, notatki lub dowolnej treści.</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <AIGenerationForm onSubmit={handleSubmit} isLoading={isLoading} limits={limits} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Limity dzienne</CardTitle>
              <CardDescription>Twoje dzisiejsze zużycie AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Generowania dziś</p>
                <div className="flex justify-between text-sm">
                  <span>
                    {limits?.generationRequests.used ?? 0} / {limits?.generationRequests.limit ?? 10}
                  </span>
                  <span className="text-muted-foreground">
                    pozostało: {limits?.generationRequests.remaining ?? "?"}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Akceptacje AI dziś</p>
                <div className="flex justify-between text-sm">
                  <span>
                    {limits?.aiAcceptedCards.used ?? 0} / {limits?.aiAcceptedCards.limit ?? 20}
                  </span>
                  <span className="text-muted-foreground">pozostało: {limits?.aiAcceptedCards.remaining ?? "?"}</span>
                </div>
              </div>
              {limits && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Reset limitów o północy UTC (za ok.{" "}
                  {Math.round((new Date(limits.resetAt).getTime() - Date.now()) / (1000 * 60 * 60))}h)
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
