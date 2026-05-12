import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import { afterAll, beforeAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_AUTH_SECRET = "0".repeat(32) + "abcdef0123456789abcdef0123456789";
const POSTGRES_SCHEMA_FILE = "prisma/schema.postgres.prisma";
const PRISMA_BIN = path.join(PROJECT_ROOT, "node_modules", ".bin", "prisma");

export type TestDbProvider = "sqlite" | "postgres";

export type TestDbHandle = {
  /** Which backend is in use; tests can branch on this without re-reading env. */
  provider: TestDbProvider;
  /** Connection target — sqlite file path or postgres schema name. */
  dbId: string;
  /** Resolves the shared Prisma client (lazy, cached). */
  getDb: () => Promise<PrismaClient>;
};

export function setupTestDb(label: string): TestDbHandle {
  if (!process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = DEFAULT_AUTH_SECRET;
  }
  const provider = (process.env.DATABASE_PROVIDER ?? "sqlite").toLowerCase();
  if (provider === "postgres" || provider === "postgresql") {
    return setupPostgresTestDb(label);
  }
  return setupSqliteTestDb(label);
}

function setupSqliteTestDb(label: string): TestDbHandle {
  const workerId = process.env.VITEST_WORKER_ID ?? "0";
  const dbPath = path.join(os.tmpdir(), `sme-${label}-w${workerId}-${Date.now()}.db`);
  process.env.DATABASE_URL = `file:${dbPath}`;

  let cached: PrismaClient | null = null;
  const getDb = async (): Promise<PrismaClient> => {
    if (cached) return cached;
    const mod = await import("@/lib/db");
    cached = mod.db as unknown as PrismaClient;
    return cached;
  };

  beforeAll(async () => {
    execSync("node_modules/.bin/prisma migrate deploy", {
      cwd: PROJECT_ROOT,
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      stdio: "pipe",
    });
    const db = await getDb();
    await db.$connect();
  });

  afterAll(async () => {
    if (cached) {
      await cached.$disconnect();
    }
    for (const ext of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(`${dbPath}${ext}`);
      } catch {
        // ignore — file may not exist
      }
    }
  });

  return { provider: "sqlite", dbId: dbPath, getDb };
}

function setupPostgresTestDb(label: string): TestDbHandle {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl || !/^postgres(ql)?:\/\//.test(baseUrl)) {
    throw new Error(
      `setupTestDb: DATABASE_PROVIDER=postgres requires DATABASE_URL=postgresql://..., got ${baseUrl ?? "(unset)"}`,
    );
  }

  const workerId = process.env.VITEST_WORKER_ID ?? "0";
  const sanitized = label.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  // Schema names must be valid PostgreSQL identifiers; quote for safety regardless.
  const schemaName = `test_w${workerId}_${sanitized}_${Date.now()}`;

  // The test client connects with ?schema=<name>. DDL for the schema itself
  // must run against the base URL (no schema override), since the schema
  // doesn't exist yet at bootstrap time.
  const testUrl = new URL(baseUrl);
  testUrl.searchParams.set("schema", schemaName);
  const bootUrl = new URL(baseUrl);
  bootUrl.searchParams.delete("schema");

  process.env.DATABASE_URL = testUrl.toString();

  let cached: PrismaClient | null = null;
  const getDb = async (): Promise<PrismaClient> => {
    if (cached) return cached;
    const mod = await import("@/lib/db");
    cached = mod.db as unknown as PrismaClient;
    return cached;
  };

  beforeAll(async () => {
    runDdl(bootUrl.toString(), `CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
    execFileSync(
      PRISMA_BIN,
      ["db", "push", `--schema=${POSTGRES_SCHEMA_FILE}`, "--skip-generate"],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, DATABASE_URL: testUrl.toString() },
        stdio: "pipe",
      },
    );
    const db = await getDb();
    await db.$connect();
  });

  afterAll(async () => {
    if (cached) {
      await cached.$disconnect();
    }
    try {
      runDdl(bootUrl.toString(), `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
    } catch (err) {
      // Surface but don't fail the run — the next CI job starts fresh.
      console.warn(`setupTestDb: failed to drop schema ${schemaName}:`, err);
    }
  });

  return { provider: "postgres", dbId: schemaName, getDb };
}

function runDdl(url: string, sql: string): void {
  // `prisma db execute` rejects --url + --schema together; --url alone is enough
  // for raw DDL since we're not introspecting models here. Use execFileSync so
  // the URL is passed as an argv element and never goes through shell parsing.
  execFileSync(PRISMA_BIN, ["db", "execute", `--url=${url}`, "--stdin"], {
    cwd: PROJECT_ROOT,
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
  });
}
