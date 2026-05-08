import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Playwright specs live under e2e/ and use @playwright/test's own runner.
    exclude: [...configDefaults.exclude, "e2e/**"],
    server: {
      deps: {
        // Next.js synthesises `server-only` at build time. Vitest doesn't, so
        // alias it to a no-op module for tests that import server-side code.
        inline: ["server-only"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
