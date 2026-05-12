# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repo is **pre-scaffold** — no application code has been written yet. The work is planned but unstarted. As a result, there are no build, lint, or test commands to document. When the scaffolding issue ([#1](https://github.com/HundredAcreStudio/sme-directory/issues/1)) lands, update this file with the actual commands.

The authoritative artifacts so far:

- [PROJECT_PLAN.md](PROJECT_PLAN.md) — proposed stack, data-model sketch, milestone breakdown, and v1 scope boundaries.
- GitHub issues #1–#19 on `HundredAcreStudio/sme-directory` — each issue is one unit of work with explicit acceptance criteria, labelled by milestone (`M1-foundation` through `M6-polish`).

When unsure what to work on next, list issues with `gh issue list --label M1-foundation` (or whichever milestone is in flight).

## Planned architecture (subject to confirmation)

The plan in [PROJECT_PLAN.md](PROJECT_PLAN.md) is a proposal, not a decided contract — confirm with the user before scaffolding if anything looks wrong. Highlights to internalize:

- **Single deployable**: Next.js 14 App Router with TypeScript. API routes live alongside the React app — there is no separate backend service.
- **Database portability**: Prisma with SQLite for local dev, Postgres for prod. Schema must avoid SQLite-only features so the connector swap stays a one-line change.
- **Auth (current — see issue #3)**: faked dev-only sign-in. A signed-JWT cookie (`sme_session`, HS256 via `jose`, signed with `AUTH_SECRET`) holds `{ sub, email, name }`; `signIn(email)` upserts a `User` and writes the cookie, gated to `NODE_ENV !== "production"`. The shim exports `auth()` / `getSession()` (server), `useSession` (client), `requireAuth()` (protected pages), `signIn` / `signOut` — same names the eventual real auth will use, so the swap is internal-only. Active Directory is the planned long-term backend; NextAuth/magic-link is deferred.
- **Search dual-track**: SQLite FTS5 in dev and Postgres `tsvector` in prod, gated by a `DATABASE_PROVIDER` env. Plan code so the query layer can branch on this without leaking DB-specific SQL into route handlers.
- **Notifications are pull-based for v1**: `Notification` rows are fanned out at write-time and polled by the client. WebSockets / push are explicitly out of scope.
- **Authorization model**: membership status (`pending` / `approved` / `rejected`) and role (`member` / `moderator` / `owner`) on `Membership` are the basis for nearly every write check. Posting questions, posting answers, accepting answers, and approving applications all key off these — keep the check helpers centralized.
- **CSRF protection (issue [#50](https://github.com/HundredAcreStudio/sme-directory/issues/50))**: double-submit cookie pattern. A non-httpOnly `sme_csrf` cookie is issued by [src/proxy.ts](src/proxy.ts) on the first non-mutating request (and rotated by `signIn` / cleared by `signOut`). The same proxy enforces a `x-csrf-token` header check on POST/PATCH/PUT/DELETE under `/api/*` and returns 403 on mismatch. New routes / actions inherit protection automatically as long as they follow these rules:
  - **API route handlers** (`app/api/**`): nothing to do — the proxy gates them. Tests bypass the proxy so route unit tests don't need a token.
  - **Client `fetch` callsites** that target `/api/*` with a mutating method: use `csrfFetch` from [src/lib/csrf-client.ts](src/lib/csrf-client.ts), or add `[CSRF_HEADER]: readCsrfToken()` to the headers object.
  - **Server actions invoked via `<form action={...}>`**: render `<CsrfField />` (client) or `<CsrfInput />` (server) inside the form, then `await assertCsrf(formData)` at the top of the action. On `CsrfError`, return the error in form state — do not let it bubble.
  - **Server actions invoked programmatically** (e.g. `await voteAction(...)` from a client component): accept a `csrfToken: string` argument, pass `readCsrfToken()` from the caller, and `await assertCsrfToken(csrfToken)` at the top of the action.

## Workflow conventions

- **Never run `git commit` to close out a task** — per the user's global rule. Stage files for review or open a PR, but do not auto-commit work.
- Issues use milestone labels (`M1-foundation`…`M6-polish`) plus surface labels (`frontend`, `backend`, `infra`). New issues should follow the same scheme.
- Each milestone issue has explicit acceptance criteria — treat those as the definition of done; if a criterion is wrong, amend the issue rather than silently diverging.

## Postgres-mode search tests

Search has a dual-track abstraction (SQLite FTS5 in dev, Postgres `tsvector` in prod). The CI job `ci-search-postgres` boots a Postgres 16 service container and runs `src/lib/search.test.ts` + `src/app/api/search/route.test.ts` with `DATABASE_PROVIDER=postgres` to keep the two backends honest — same assertions, both providers. Divergence is a bug in the dual-track abstraction, not the test.

- **Provider switch**: `setupTestDb()` in [test/db.ts](test/db.ts) branches on `DATABASE_PROVIDER`. SQLite path uses a per-worker `*.db` file + `prisma migrate deploy` (unchanged). Postgres path derives a per-worker schema name (`test_w<id>_..._<ts>`), runs `prisma db push --schema=prisma/schema.postgres.prisma --skip-generate` to sync it (no migrations — the FTS5 migration is SQLite-only), and drops the schema in `afterAll`.
- **Generated schema**: `prisma/schema.postgres.prisma` is built from `prisma/schema.prisma` by [scripts/generate-postgres-schema.mjs](scripts/generate-postgres-schema.mjs) — single source of truth, only the datasource provider differs. The generated file is git-ignored; regenerate with `npm run db:gen-postgres-schema`.
- **SQLite-only assertions**: the `toFtsMatchExpr` describe block in `search.test.ts` uses `describe.skipIf(isPostgres)` because the Postgres branch (`runTsvector`) bypasses that helper entirely.

To reproduce locally:

```sh
# 1. Boot Postgres 16 (any reachable instance works)
docker run --rm -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16

# 2. Generate the Postgres schema and Prisma client
npm run db:gen-postgres-schema
npx prisma generate --schema=prisma/schema.postgres.prisma

# 3. Run the search suite against Postgres
DATABASE_PROVIDER=postgres \
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres \
  npm run test -- --project node src/lib/search.test.ts src/app/api/search/route.test.ts

# 4. Restore the SQLite Prisma client when done
npx prisma generate
```

## End-to-end tests (Playwright)

Specs live in [e2e/](e2e/) and run against an isolated SQLite database (`prisma/e2e.db`) so they never touch `prisma/dev.db`. The harness boots its own dev server.

- **Run**: `npm run test:e2e`. First-time / CI also needs `npm run test:e2e:install` to download the chromium binary.
- **How it works**: [e2e/global-setup.ts](e2e/global-setup.ts) wipes `prisma/e2e.db`, then runs `prisma migrate deploy` and `prisma db seed` against it. Playwright's `webServer` then starts `next dev` with `DATABASE_URL=file:./e2e.db` (configured in [playwright.config.ts](playwright.config.ts)).
- **Adding a spec**: drop a `*.spec.ts` under `e2e/`. Prefer `getByRole` / `getByLabel` over CSS selectors. Drive flows through the UI rather than calling APIs directly so the proxy, CSRF, and server actions all get exercised. Use timestamped emails / slugs (e.g. `owner-${Date.now()}@example.com`) so reruns don't collide with prior state when the DB isn't reset between runs.
- **Two-user flows**: open a separate `browser.newContext()` per user so session cookies don't clash.
- **Caveats**: tests run serially (`fullyParallel: false`, `workers: 1`) because the DB is shared. Reports land in `playwright-report/` and traces in `test-results/` — both gitignored.

## Component tests (Vitest + React Testing Library)

Component tests run in jsdom and live alongside their components. They are configured as a separate Vitest project so the existing node-environment route and lib tests stay in node — see [vitest.config.ts](vitest.config.ts).

- **Run**: `npm run test` (runs both `node` and `dom` projects). `npm run test:watch` for watch mode.
- **File suffix**: `*.dom.test.tsx`. Anything else stays in the node project.
- **Location**: colocate with the component (e.g. `src/components/foo.tsx` → `src/components/foo.dom.test.tsx`).
- **Setup**: jsdom + `@testing-library/jest-dom` matchers + RTL `cleanup` are registered by [test/setup-dom.ts](test/setup-dom.ts) — no per-file imports needed beyond `@testing-library/react` and `@testing-library/user-event`.

### Mocking common dependencies

- `next/navigation` — hoist a shared spy so the mock and assertions point at the same function:
  ```ts
  const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
  vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
  ```
- `@/lib/csrf-client` — stub the token reader and fetch wrapper so tests don't need a `sme_csrf` cookie:
  ```ts
  vi.mock("@/lib/csrf-client", () => ({
    readCsrfToken: vi.fn(() => "test-token"),
    csrfFetch: vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))),
  }));
  ```
- `@/lib/auth-client` (`useSession`) — `vi.mock` it and set the return value per test (`mockedUseSession.mockReturnValue(...)`).
- Server actions (e.g. `voteAction`, `favoriteAction`) — mock the local module: `vi.mock("./vote-actions", () => ({ voteAction: vi.fn() }))`.
- `global.fetch` — `vi.stubGlobal("fetch", vi.fn(...))`; reset in `afterEach` with `vi.unstubAllGlobals()`.

### Timers and debounce

Two strategies depending on what you're testing:

- **Debounce / typeahead** (`SearchControls`, `AuthorPicker`): keep real timers and assert with `waitFor`. Combining `userEvent` with `vi.useFakeTimers()` is fragile (we hit hangs in jsdom).
  ```ts
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/search/i), "hello");
  await waitFor(() => expect(replace).toHaveBeenCalled());
  ```
- **Polling intervals** (`NotificationBell`): fake only the interval timers so we can advance through poll cycles deterministically.
  ```ts
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  await act(async () => {
    vi.advanceTimersByTime(30_000);
  });
  ```

`NotificationBell` queues its initial fetch as a microtask (`Promise.resolve().then(...)`); flush with `await act(async () => { await Promise.resolve(); })` before asserting on rendered state.

### What to test

Behavior, not implementation. Good targets: optimistic UI updates, error rollback, ARIA roles/names (`aria-pressed`, `aria-label`, `role="alert"`), debounce-driven side effects (`router.replace` URL contents, fetch URLs). Avoid asserting on Tailwind class strings.
