import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

const sharedAlias = {
  "@": path.resolve(__dirname, "src"),
  "@test": path.resolve(__dirname, "test"),
  // Next.js synthesises `server-only` at build time. Vitest doesn't, so
  // alias it to a no-op module for tests that import server-side code.
  "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
};

const sharedServerDeps = {
  inline: ["server-only"] as string[],
};

export default defineConfig({
  resolve: {
    alias: sharedAlias,
  },
  test: {
    projects: [
      {
        resolve: { alias: sharedAlias },
        test: {
          name: "node",
          environment: "node",
          server: { deps: sharedServerDeps },
          include: ["src/**/*.test.{ts,tsx}"],
          // The include glob `*.test.{ts,tsx}` also matches `*.dom.test.tsx`,
          // so we must explicitly exclude dom tests here — they belong to the
          // jsdom project below. Don't drop this exclude.
          exclude: [...configDefaults.exclude, "e2e/**", "src/**/*.dom.test.tsx"],
        },
      },
      {
        resolve: { alias: sharedAlias },
        test: {
          name: "dom",
          environment: "jsdom",
          server: { deps: sharedServerDeps },
          include: ["src/**/*.dom.test.tsx"],
          setupFiles: ["./test/setup-dom.ts"],
        },
      },
    ],
  },
});
