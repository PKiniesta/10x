import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { startAiGenerationCommandSchema } from "@/lib/validation/ai-generation";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { StartAiGenerationCommand, TodayLimitsDto } from "@/types";

interface AIGenerationFormProps {
  onSubmit: (data: StartAiGenerationCommand) => Promise<void>;
  isLoading: boolean;
  limits: TodayLimitsDto | null;
}

export function AIGenerationForm({ onSubmit, isLoading, limits }: AIGenerationFormProps) {
  const form = useForm<StartAiGenerationCommand>({
    resolver: zodResolver(startAiGenerationCommandSchema),
    defaultValues: {
      inputText: "",
      requestedCardsCount: 8,
    },
  });

  const inputTextValue = form.watch("inputText") || "";
  const isLimitReached = limits ? limits.generationRequests.remaining <= 0 : false;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="inputText"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Tekst źródłowy</FormLabel>
                <span
                  className={`text-xs ${inputTextValue.length < 100 || inputTextValue.length > 1000 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {inputTextValue.length}/1000
                </span>
              </div>
              <FormControl>
                <Textarea
                  placeholder="Wlej tutaj tekst, z którego AI przygotuje propozycje fiszek (min. 100 znaków)..."
                  className="min-h-[200px] resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>Wprowadź od 100 do 1000 znaków.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="requestedCardsCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Liczba propozycji</FormLabel>
              <FormControl>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={field.value}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                  disabled={isLoading || isLimitReached}
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 3 ? "propozycje" : n >= 5 ? "propozycji" : "propozycje"}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-4">
          {isLimitReached && (
            <p className="text-sm text-destructive font-medium">
              Wykorzystano dzienny limit generowań. Spróbuj ponownie po{" "}
              {limits ? new Date(limits.resetAt).toLocaleTimeString("pl-PL") : "restarcie"}.
            </p>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={isLoading || isLimitReached || inputTextValue.length < 100}
          >
            {isLoading ? "Generowanie..." : "Generuj fiszki przez AI"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
