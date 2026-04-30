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
npm run dev
```

The app will be available at http://localhost:3000.

## Scripts

| Script                 | What it does                               |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Start the dev server (Turbopack)           |
| `npm run build`        | Production build                           |
| `npm start`            | Run the production build                   |
| `npm run lint`         | ESLint (Next.js config + Prettier-aligned) |
| `npm run typecheck`    | TypeScript no-emit check                   |
| `npm run format`       | Prettier write                             |
| `npm run format:check` | Prettier check (no writes)                 |

## Project layout

```
src/
  app/              # App Router routes and root layout
  components/       # Shared UI components (header, footer, …)
prisma/             # (planned) schema + migrations
```

## Contributing

Work is tracked as GitHub issues grouped into milestone labels (`M1-foundation` … `M6-polish`). Each issue lists explicit acceptance criteria — treat those as the definition of done.
