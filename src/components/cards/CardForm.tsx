import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateManualCardSchema, type CreateManualCardInput } from "@/lib/validation/cards";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface CardFormProps {
  onSubmit: (data: CreateManualCardInput) => Promise<void>;
  isLoading: boolean;
  defaultValues?: Partial<CreateManualCardInput>;
  onCancel?: () => void;
}

export function CardForm({ onSubmit, isLoading, defaultValues, onCancel }: CardFormProps) {
  const form = useForm<CreateManualCardInput>({
    resolver: zodResolver(CreateManualCardSchema),
    defaultValues: {
      front: defaultValues?.front ?? "",
      back: defaultValues?.back ?? "",
    },
  });

  const frontValue = form.watch("front") || "";
  const backValue = form.watch("back") || "";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="front"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Awers (front)</FormLabel>
                <span className={`text-xs ${frontValue.length > 200 ? "text-destructive" : "text-muted-foreground"}`}>
                  {frontValue.length}/200
                </span>
              </div>
              <FormControl>
                <Input placeholder="Wpisz treść na przód fiszki..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="back"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel>Rewers (back)</FormLabel>
                <span className={`text-xs ${backValue.length > 500 ? "text-destructive" : "text-muted-foreground"}`}>
                  {backValue.length}/500
                </span>
              </div>
              <FormControl>
                <Textarea placeholder="Wpisz treść na tył fiszki..." className="min-h-[120px] resize-none" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                globalThis.location.href = "/cards";
              }
            }}
            disabled={isLoading}
          >
            Anuluj
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Zapisywanie..." : "Zapisz fiszkę"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
