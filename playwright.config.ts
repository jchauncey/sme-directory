import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["E2E_PORT"] ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

const E2E_DATABASE_URL = "file:./e2e.db";
const E2E_AUTH_SECRET = process.env.AUTH_SECRET ?? "e2e-dev-only-secret-32-chars-min-xx";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    // Use port-based readiness instead of URL-based: polling `/` would render
    // the home page, which opens a Prisma connection to the SQLite db — and
    // globalSetup unlinks + recreates that file, leaving the warm connection
    // pointed at a moved inode (SQLITE_READONLY_DBMOVED) for the rest of the
    // run.
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      AUTH_SECRET: E2E_AUTH_SECRET,
    },
  },
});
