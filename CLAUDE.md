# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

This repo is **pre-scaffold** — no application code has been written yet. The work is planned but unstarted. As a result, there are no build, lint, or test commands to document. When the scaffolding issue ([#1](https://github.com/jchauncey/sme-directory/issues/1)) lands, update this file with the actual commands.

The authoritative artifacts so far:

- [PROJECT_PLAN.md](PROJECT_PLAN.md) — proposed stack, data-model sketch, milestone breakdown, and v1 scope boundaries.
- GitHub issues #1–#19 on `jchauncey/sme-directory` — each issue is one unit of work with explicit acceptance criteria, labelled by milestone (`M1-foundation` through `M6-polish`).

When unsure what to work on next, list issues with `gh issue list --label M1-foundation` (or whichever milestone is in flight).

## Planned architecture (subject to confirmation)

The plan in [PROJECT_PLAN.md](PROJECT_PLAN.md) is a proposal, not a decided contract — confirm with the user before scaffolding if anything looks wrong. Highlights to internalize:

- **Single deployable**: Next.js 14 App Router with TypeScript. API routes live alongside the React app — there is no separate backend service.
- **Database portability**: Prisma with SQLite for local dev, Postgres for prod. Schema must avoid SQLite-only features so the connector swap stays a one-line change.
- **Auth (current — see issue #3)**: faked dev-only sign-in. A signed-JWT cookie (`sme_session`, HS256 via `jose`, signed with `AUTH_SECRET`) holds `{ sub, email, name }`; `signIn(email)` upserts a `User` and writes the cookie, gated to `NODE_ENV !== "production"`. The shim exports `auth()` / `getSession()` (server), `useSession` (client), `requireAuth()` (protected pages), `signIn` / `signOut` — same names the eventual real auth will use, so the swap is internal-only. Active Directory is the planned long-term backend; NextAuth/magic-link is deferred.
- **Search dual-track**: SQLite FTS5 in dev and Postgres `tsvector` in prod, gated by a `DATABASE_PROVIDER` env. Plan code so the query layer can branch on this without leaking DB-specific SQL into route handlers.
- **Notifications are pull-based for v1**: `Notification` rows are fanned out at write-time and polled by the client. WebSockets / push are explicitly out of scope.
- **Authorization model**: membership status (`pending` / `approved` / `rejected`) and role (`member` / `moderator` / `owner`) on `Membership` are the basis for nearly every write check. Posting questions, posting answers, accepting answers, and approving applications all key off these — keep the check helpers centralized.

## Workflow conventions

- **Never run `git commit` to close out a task** — per the user's global rule. Stage files for review or open a PR, but do not auto-commit work.
- Issues use milestone labels (`M1-foundation`…`M6-polish`) plus surface labels (`frontend`, `backend`, `infra`). New issues should follow the same scheme.
- Each milestone issue has explicit acceptance criteria — treat those as the definition of done; if a criterion is wrong, amend the issue rather than silently diverging.
