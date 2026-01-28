import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function SearchInput({ value, onChange, placeholder = "Szukaj…", disabled }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="cards-search">
        Wyszukaj fiszki
      </label>
      <Input
        id="cards-search"
        type="search"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={200}
        onChange={(e) => onChange(e.currentTarget.value.slice(0, 200))}
        className="text-foreground"
      />

      <Button
        type="button"
        variant="outline"
        disabled={disabled || value.length === 0}
        onClick={() => onChange("")}
        aria-label="Wyczyść wyszukiwanie"
      >
        Wyczyść
      </Button>
    </div>
  );
}
