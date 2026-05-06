/**
 * searchUsersByNameOrEmail tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDbPath = path.join(os.tmpdir(), `sme-users-test-${Date.now()}.db`);
process.env["DATABASE_URL"] = `file:${testDbPath}`;

const { db } = await import("./db");
const { searchUsersByNameOrEmail } = await import("./users");

beforeAll(async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  execSync("node_modules/.bin/prisma migrate deploy", {
    cwd: root,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "pipe",
  });
  await db.$connect();
});

afterAll(async () => {
  await db.$disconnect();
  for (const ext of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${testDbPath}${ext}`);
    } catch {
      // ignore
    }
  }
});

let counter = 0;
function uniq(label: string): string {
  counter += 1;
  return `${label}-${Date.now()}-${counter}`;
}

describe("searchUsersByNameOrEmail", () => {
  it("returns empty for blank query", async () => {
    expect(await searchUsersByNameOrEmail("")).toEqual([]);
    expect(await searchUsersByNameOrEmail("   ")).toEqual([]);
  });

  it("matches by name (case-insensitive ASCII)", async () => {
    await db.user.create({
      data: { email: `${uniq("nm")}@example.com`, name: "Jane Quokka" },
    });
    const matches = await searchUsersByNameOrEmail("quokka");
    expect(matches.some((m) => m.name === "Jane Quokka")).toBe(true);
  });

  it("matches by email substring", async () => {
    const target = `${uniq("specific-pgvector")}@example.com`;
    await db.user.create({ data: { email: target, name: "Alex P" } });
    const matches = await searchUsersByNameOrEmail("pgvector");
    expect(matches.some((m) => m.email === target)).toBe(true);
  });

  it("caps the result count at the limit (max 20)", async () => {
    const tag = uniq("bulk");
    for (let i = 0; i < 5; i += 1) {
      await db.user.create({
        data: { email: `${tag}-${i}@example.com`, name: `${tag} user ${i}` },
      });
    }
    const limited = await searchUsersByNameOrEmail(tag, 2);
    expect(limited.length).toBeLessThanOrEqual(2);
    const big = await searchUsersByNameOrEmail(tag, 999);
    expect(big.length).toBeLessThanOrEqual(20);
  });
});
