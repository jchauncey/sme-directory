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

After seeding, dev sign-in works with any of:
`alice@example.com`, `bob@example.com`, `carol@example.com`, `dave@example.com`, `eve@example.com`.
The seed is idempotent — re-running it converges on the same dataset.

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

## Project layout

```
src/
  app/              # App Router routes and root layout
  components/       # Shared UI components (header, footer, …)
prisma/             # (planned) schema + migrations
```

## Contributing

Work is tracked as GitHub issues grouped into milestone labels (`M1-foundation` … `M6-polish`). Each issue lists explicit acceptance criteria — treat those as the definition of done.
