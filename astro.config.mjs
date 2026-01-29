// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// Plugin to ignore test files during build
const ignoreTestFiles = () => ({
  name: "ignore-test-files",
  resolveId(id) {
    if (id.includes(".test.") || id.includes(".spec.")) {
      return { id, external: true };
    }
  },
});

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  server: { port: 3000 },
  vite: {
    plugins: [tailwindcss(), ignoreTestFiles()],
    ssr: {
      external: ["node:crypto"],
      noExternal: [],
    },
    build: {
      rollupOptions: {
        external: [/\.test\.(ts|tsx|js|jsx)$/, /\.spec\.(ts|tsx|js|jsx)$/, "supertest", "msw", "@mswjs/interceptors"],
      },
    },
  },
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
});
