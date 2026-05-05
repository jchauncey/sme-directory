# SME Directory

A directory webapp where users form Subject Matter Expert (SME) groups, apply for membership, and ask/answer questions within those groups. See [PROJECT_PLAN.md](PROJECT_PLAN.md) for the full plan and milestone breakdown.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- ESLint + Prettier
- (planned) Prisma + SQLite/Postgres, NextAuth.js, shadcn/ui — see [PROJECT_PLAN.md](PROJECT_PLAN.md)

> Note: the original issue specified Next.js 14, but `create-next-app@latest` ships Next.js 16. The App Router idioms used here are compatible with both — flag if you want to pin to 14 instead.

## Prerequisites

- Node.js 20+ (developed on 23.x)
- npm 10+

## Setup

```bash
npm install
npm run db:migrate    # apply schema to local SQLite
npm run db:seed       # populate sample data (optional, recommended)
npm run dev
```

The app will be available at http://localhost:3000.

The seed is idempotent — re-running it converges on the same dataset.

## Dev sign-in

Authentication is currently a dev-only shim ([`src/lib/auth.ts`](src/lib/auth.ts)) that will be replaced with Active Directory. It is **email-only — no password** — and `signIn()` throws when `NODE_ENV === "production"`, so this flow cannot ship.

To sign in:

1. Visit http://localhost:3000/login.
2. Type one of the seeded emails below and submit.

Typing an unseeded email creates a new bare-bones user on first sign-in (no group memberships) — that's expected, not a bug.

| Email               | Name        | Pick this user to test…                                                        |
| ------------------- | ----------- | ------------------------------------------------------------------------------ |
| `alice@example.com` | Alice Adams | Owner flows in **Go**; all-notifications-read state                            |
| `bob@example.com`   | Bob Brown   | Owner flows in **React**; unread-notifications bell badge                      |
| `carol@example.com` | Carol Chen  | Owner of **Kubernetes**; moderator actions in Go                               |
| `dave@example.com`  | Dave Davis  | Owner of **Python**; moderator actions in React                                |
| `eve@example.com`   | Eve Evans   | Mixed membership states (pending, rejected, owner) for moderation/edge-case UI |

For the full membership matrix, edge-case fixtures, notification read/unread split, and search keywords planted for FTS testing, see [`prisma/README.md`](prisma/README.md).

## Scripts

| Script                 | What it does                                        |
| ---------------------- | --------------------------------------------------- |
| `npm run dev`          | Start the dev server (Turbopack)                    |
| `npm run build`        | Production build                                    |
| `npm start`            | Run the production build                            |
| `npm run lint`         | ESLint (Next.js config + Prettier-aligned)          |
| `npm run typecheck`    | TypeScript no-emit check                            |
| `npm run format`       | Prettier write                                      |
| `npm run format:check` | Prettier check (no writes)                          |
| `npm run db:migrate`   | Apply Prisma migrations to the local DB             |
| `npm run db:reset`     | Reset the local DB and re-run migrations (re-seeds) |
| `npm run db:seed`      | Populate the DB with sample users, groups, and Q&A  |
| `npm run db:studio`    | Open Prisma Studio                                  |

## Continuous Integration

`.github/workflows/ci.yml` runs on every PR targeting `main` (and on pushes to `main`). It executes `npm ci`, `npm run lint`, `npm run typecheck`, `npx prisma validate`, and `npm run test` on Node 20.

### Required status checks

Once CI has run at least once on the repo, enforce it on `main`:

1. Go to **Settings → Branches** and add (or edit) the branch protection rule for `main`.
2. Enable **Require status checks to pass before merging**.
3. In the search box, add the `ci` check.
4. (Recommended) Enable **Require branches to be up to date before merging**.

The `ci` check name only appears in the dropdown after the workflow has completed at least one run, so open a throwaway PR first if needed.

## Project layout

```
src/
  app/              # App Router routes and root layout
  components/       # Shared UI components (header, footer, …)
prisma/             # (planned) schema + migrations
```

## Contributing

Work is tracked as GitHub issues grouped into milestone labels (`M1-foundation` … `M6-polish`). Each issue lists explicit acceptance criteria — treat those as the definition of done.
