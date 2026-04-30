# SME Directory — Project Plan

A directory webapp where users form Subject Matter Expert (SME) groups, apply for membership, and ask/answer questions within those groups.

## Proposed stack

| Concern       | Choice                                         | Why                                                                             |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| Framework     | Next.js 14 (App Router) + TypeScript           | React with built-in API routes — single deployable, no separate backend service |
| Database      | SQLite (dev) → PostgreSQL (prod) via Prisma    | Prisma's connector swap keeps the local dev story simple                        |
| Auth          | NextAuth.js (email magic-link + credentials)   | First-party Next.js integration, session handling out of the box                |
| UI            | Tailwind CSS + shadcn/ui                       | Composable primitives, no heavy component library lock-in                       |
| Data fetching | TanStack Query (client) + RSC (server)         | Clear split between cache-driven UI and server-rendered shells                  |
| Search        | Postgres full-text in prod; SQLite FTS5 in dev | Avoids a separate search service for v1                                         |
| Tests         | Vitest + Playwright                            | Unit + e2e                                                                      |

This is a starting point — happy to revise (e.g. Remix, separate Express API, Drizzle instead of Prisma) before scaffolding lands.

## Data model (sketch)

- `User` — id, email, name, image
- `Group` — id, slug, name, description, autoApprove (bool), createdById
- `Membership` — userId, groupId, role (`member` | `moderator` | `owner`), status (`pending` | `approved` | `rejected`)
- `Question` — id, groupId, authorId, title, body, status (`open` | `answered`), acceptedAnswerId
- `Answer` — id, questionId, authorId, body
- `Vote` — userId, targetType (`question` | `answer`), targetId, value (+1/-1)
- `Favorite` — userId, targetType, targetId
- `Notification` — userId, type, payload, readAt

## Milestones

### M1 — Foundation

Scaffold the app, database, auth, and shared UI shell so feature work has somewhere to land.

### M2 — SME Groups (Reqs 1, 2)

Create and browse groups; apply for membership with conditional or automatic approval.

### M3 — Questions & Answers (Reqs 3, 4)

Post questions to a group, notify members, post answers, vote, and mark answered.

### M4 — Engagement & Profile (Reqs 5, 6)

Favorites and a profile page surfacing the user's own activity.

### M5 — Search (Req 7)

Search with scopes: current group, selected groups, or all groups.

### M6 — Polish

Seed data, CI, and deployment docs.

## Out of scope for v1

- Real-time push (WebSockets) — notifications are pull-based for v1
- Email digests
- Rich-text editor — Markdown only
- Reputation / badges
- Moderation tooling beyond approve/reject membership
