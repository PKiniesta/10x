import * as React from "react";
import { type StartAiGenerationSuccessDto, type AiCardProposalDto } from "@/types";
import { acceptProposal, rejectProposal } from "@/lib/services/ai.api";
import { CardForm } from "./CardForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, X, Edit, ArrowLeft } from "lucide-react";

export function AIReviewPage() {
  const [data, setData] = React.useState<StartAiGenerationSuccessDto | null>(null);
  const [decisions, setDecisions] = React.useState<Record<number, "accepted" | "rejected" | "editing">>({});
  const [error, setError] = React.useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = React.useState<number | null>(null);

  React.useEffect(() => {
    const raw = sessionStorage.getItem("ai_proposals");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.ok) {
          setData(parsed);
        }
      } catch (err) {
        console.error("Failed to parse proposals from sessionStorage", err);
      }
    }
  }, []);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-muted-foreground">Nie znaleziono propozycji do przeglądu.</p>
        <Button onClick={() => (globalThis.location.href = "/ai/generate")}>Wróć do generowania</Button>
      </div>
    );
  }

  const handleAccept = async (index: number, proposal: AiCardProposalDto) => {
    setIsActionLoading(index);
    setError(null);
    try {
      await acceptProposal(data.generationId, index, {
        front: proposal.front,
        back: proposal.back,
        reviewToken: data.reviewToken,
      });
      setDecisions((prev) => ({ ...prev, [index]: "accepted" }));
    } catch (err: unknown) {
      const error = err as Error;
      setError(error?.message || "Nie udało się zaakceptować propozycji.");
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleReject = async (index: number) => {
    setIsActionLoading(index);
    setError(null);
    try {
      await rejectProposal(data.generationId, index, data.reviewToken);
      setDecisions((prev) => ({ ...prev, [index]: "rejected" }));
    } catch (err: unknown) {
      const error = err as Error;
      setError(error?.message || "Nie udało się odrzucić propozycji.");
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleSaveEdit = async (index: number, updated: { front: string; back: string }) => {
    // For editing in review, we just update the local proposal and then the user has to click "Accept"
    // or we could combine it. The UI plan says "Edytuj/Akceptuj/Odrzuć".
    // Usually, "Edytuj" opens a form, and saving it updates the proposal in the list.

    const newData = { ...data };
    newData.proposals[index] = { ...newData.proposals[index], ...updated };
    setData(newData);
    setDecisions((prev) => ({ ...prev, [index]: undefined }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => (globalThis.location.href = "/ai/generate")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Przegląd propozycji</h1>
          <p className="text-muted-foreground font-medium">Zaakceptuj lub odrzuć wygenerowane fiszki.</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {data.proposals.map((proposal, index) => {
          const status = decisions[index];

          if (status === "editing") {
            return (
              <Card key={index} className="border-primary">
                <CardHeader>
                  <CardTitle>Edytuj propozycję #{index + 1}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardForm
                    onSubmit={async (vals) => handleSaveEdit(index, vals)}
                    isLoading={false}
                    defaultValues={{ front: proposal.front, back: proposal.back }}
                    onCancel={() => setDecisions((prev) => ({ ...prev, [index]: undefined }))}
                  />
                </CardContent>
              </Card>
            );
          }

          return (
            <Card
              key={index}
              className={
                status === "accepted"
                  ? "opacity-50 border-green-500"
                  : status === "rejected"
                    ? "opacity-50 border-destructive"
                    : ""
              }
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-medium">Propozycja #{index + 1}</CardTitle>
                  {status && (
                    <span
                      className={`text-xs font-bold uppercase ${status === "accepted" ? "text-green-600" : "text-destructive"}`}
                    >
                      {status === "accepted" ? "Zaakceptowano" : "Odrzucono"}
                    </span>
                  )}
                </div>
                {!status && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDecisions((prev) => ({ ...prev, [index]: "editing" }))}
                      disabled={isActionLoading !== null}
                    >
                      <Edit className="h-4 w-4 mr-1" /> Edytuj
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleReject(index)}
                      disabled={isActionLoading !== null}
                    >
                      <X className="h-4 w-4 mr-1" /> Odrzuć
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleAccept(index, proposal)}
                      disabled={isActionLoading !== null}
                    >
                      <Check className="h-4 w-4 mr-1" /> Akceptuj
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 mt-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase">Awers</p>
                  <p className="text-sm">{proposal.front}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-bold uppercase">Rewers</p>
                  <p className="text-sm">{proposal.back}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center pt-6">
        <Button variant="outline" onClick={() => (globalThis.location.href = "/cards")}>
          Zakończ przegląd
        </Button>
      </div>
    </div>
  );
}
