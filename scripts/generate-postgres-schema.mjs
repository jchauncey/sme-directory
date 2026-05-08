#!/usr/bin/env node
// Derives prisma/schema.postgres.prisma from prisma/schema.prisma by swapping
// the datasource provider to "postgresql". The generated file is git-ignored
// and consumed by the Postgres-mode test path (test/db.ts) and the
// ci-search-postgres CI job.
//
// Run via `npm run db:gen-postgres-schema`.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = path.join(root, "prisma", "schema.prisma");
const target = path.join(root, "prisma", "schema.postgres.prisma");

const original = readFileSync(source, "utf8");

// Locate the `datasource db { ... }` block by name and walk braces so a future
// nested `{ ... }` inside the block (e.g. options bearing JSON) wouldn't
// confuse the rewrite. Then swap only the `provider = "sqlite"` line inside
// that specific block.
const blockHeaderRe = /datasource\s+db\s*\{/m;
const headerMatch = blockHeaderRe.exec(original);
if (!headerMatch) {
  console.error(
    "generate-postgres-schema: no `datasource db { ... }` block found in schema.prisma",
  );
  process.exit(1);
}

const blockStart = headerMatch.index + headerMatch[0].length;
let depth = 1;
let blockEnd = -1;
for (let i = blockStart; i < original.length; i++) {
  const ch = original[i];
  if (ch === "{") depth++;
  else if (ch === "}") {
    depth--;
    if (depth === 0) {
      blockEnd = i;
      break;
    }
  }
}
if (blockEnd === -1) {
  console.error("generate-postgres-schema: unterminated `datasource db` block");
  process.exit(1);
}

const block = original.slice(blockStart, blockEnd);
const providerRe = /(provider\s*=\s*)"sqlite"/;
if (!providerRe.test(block)) {
  console.error(
    'generate-postgres-schema: expected `provider = "sqlite"` inside `datasource db` block',
  );
  process.exit(1);
}
const rewrittenBlock = block.replace(providerRe, '$1"postgresql"');

const rewritten =
  original.slice(0, blockStart) +
  rewrittenBlock +
  original.slice(blockEnd);

const banner =
  "// AUTO-GENERATED from schema.prisma by scripts/generate-postgres-schema.mjs — do not edit.\n" +
  "// Regenerate with `npm run db:gen-postgres-schema`.\n\n";

writeFileSync(target, banner + rewritten);
console.log(`generate-postgres-schema: wrote ${path.relative(root, target)}`);
