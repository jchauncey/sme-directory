import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_AUTH_SECRET =
  "0".repeat(32) + "abcdef0123456789abcdef0123456789";

export type TestDbHandle = {
  /** Absolute path to the SQLite file backing this test run. */
  dbPath: string;
  /** Resolves the shared Prisma client (lazy, cached). */
  getDb: () => Promise<PrismaClient>;
};

export function setupTestDb(label: string): TestDbHandle {
  const workerId = process.env.VITEST_WORKER_ID ?? "0";
  const dbPath = path.join(
    os.tmpdir(),
    `sme-${label}-w${workerId}-${Date.now()}.db`,
  );
  process.env.DATABASE_URL = `file:${dbPath}`;
  if (!process.env.AUTH_SECRET) {
    process.env.AUTH_SECRET = DEFAULT_AUTH_SECRET;
  }

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

  return { dbPath, getDb };
}
