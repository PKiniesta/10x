import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Wystąpił błąd podczas logowania");
        return;
      }

      globalThis.location.href = "/cards";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd podczas logowania");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md" data-test-id="login-card">
      <CardHeader>
        <CardTitle className="text-center text-2xl">Logowanie</CardTitle>
        <CardDescription className="text-center">Wprowadź swoje dane, aby uzyskać dostęp do konta.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive" data-test-id="login-error-message">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@example.com" {...field} data-test-id="login-email-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Hasło</FormLabel>
                    <a
                      href="/forgot-password"
                      title="Odzyskaj hasło"
                      className="text-primary text-sm hover:underline"
                      data-test-id="forgot-password-link"
                    >
                      Zapomniałeś hasła?
                    </a>
                  </div>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} data-test-id="login-password-input" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading} data-test-id="login-submit-button">
              {isLoading ? "Logowanie..." : "Zaloguj się"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4">
        <div className="text-sm text-center text-muted-foreground">
          Nie masz jeszcze konta?{" "}
          <a
            href="/register"
            title="Zarejestruj się"
            className="text-primary hover:underline"
            data-test-id="register-link"
          >
            Zarejestruj się
          </a>
        </div>
      </CardFooter>
    </Card>
  );
}
