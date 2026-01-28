import * as React from "react";

import { Button } from "@/components/ui/button";

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
      <input
        id="cards-search"
        type="search"
        className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={200}
        onChange={(e) => onChange(e.currentTarget.value.slice(0, 200))}
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
