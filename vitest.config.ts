/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  plugins: [],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts", "src/**/*.spec.ts", "src/**/*.test.tsx", "src/**/*.spec.tsx"],
    },
    alias: {
      "@": resolve(__dirname, "./src"),
      "astro:middleware": resolve(__dirname, "./tests/mocks/astro-middleware.ts"),
      "astro:env/server": resolve(__dirname, "./tests/mocks/astro-env-server.ts"),
    },
  },
});
