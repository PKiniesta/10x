import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<"light" | "dark" | "system">("system");

  React.useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, []);

  React.useEffect(() => {
    const root = globalThis.document.documentElement;

    const applyTheme = (currentTheme: "light" | "dark" | "system") => {
      if (currentTheme === "system") {
        const isDark = globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
        root.classList.remove("light", "dark");
        root.classList.add(isDark ? "dark" : "light");
        localStorage.removeItem("theme");
      } else {
        root.classList.remove("light", "dark");
        root.classList.add(currentTheme);
        localStorage.setItem("theme", currentTheme);
      }
    };

    applyTheme(theme);

    if (theme === "system") {
      const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Przełącz motyw</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Jasny</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Ciemny</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>Systemowy</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
