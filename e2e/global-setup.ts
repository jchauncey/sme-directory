import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const DATABASE_URL = "file:./e2e.db";

export default async function globalSetup(): Promise<void> {
  const repoRoot = path.resolve(__dirname, "..");
  const dbFile = path.join(repoRoot, "prisma", "e2e.db");
  const dbJournal = path.join(repoRoot, "prisma", "e2e.db-journal");

  rmSync(dbFile, { force: true });
  rmSync(dbJournal, { force: true });

  const env = { ...process.env, DATABASE_URL };

  execSync("npx prisma migrate deploy", { cwd: repoRoot, env, stdio: "inherit" });
  execSync("npx prisma db seed", { cwd: repoRoot, env, stdio: "inherit" });
}
