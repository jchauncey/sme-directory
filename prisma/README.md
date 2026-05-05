# Dev seed reference

This directory holds the Prisma schema, migrations, and the dev seed script
([`seed.ts`](seed.ts)). The seed populates the local SQLite database with a
fixed cast of users, groups, memberships, Q&A, votes, favorites, and
notifications — enough to exercise every flow in the app without manual
data entry.

## How to run

| Command             | What it does                                                              |
| ------------------- | ------------------------------------------------------------------------- |
| `npm run db:seed`   | Idempotent — re-running converges on the same dataset, never destructive. |
| `npm run db:reset`  | Wipes the dev DB, re-applies migrations, then auto-runs the seed.         |
| `npm run db:studio` | Browse the data in Prisma Studio.                                         |

After seeding, sign in (dev-only) at http://localhost:3000 with any of the
emails in the [Test users](#test-users) table.

## Final row counts

After a clean seed, expect:

| Entity        | Count |
| ------------- | ----- |
| Users         | 5     |
| Groups        | 5     |
| Memberships   | 25    |
| Questions     | 50    |
| Answers       | 34    |
| Votes         | 25    |
| Favorites     | 10    |
| Notifications | 140   |

The seed script logs the same counts at the end of each run — diff the
two runs to confirm idempotency.

## Test users

| Email               | Display name | ID                | Role summary                                                                  |
| ------------------- | ------------ | ----------------- | ----------------------------------------------------------------------------- |
| `alice@example.com` | Alice Adams  | `seed-user-alice` | Owner of **Go**; member of every other group; has read **all** notifications. |
| `bob@example.com`   | Bob Brown    | `seed-user-bob`   | Owner of **React**; mixed roles elsewhere; has unread notifications.          |
| `carol@example.com` | Carol Chen   | `seed-user-carol` | Owner of **Kubernetes**; moderator in Go; has read **all** notifications.     |
| `dave@example.com`  | Dave Davis   | `seed-user-dave`  | Owner of **Python**; moderator in React; has unread notifications.            |
| `eve@example.com`   | Eve Evans    | `seed-user-eve`   | Owner of **DevOps**; mixed states (rejected, pending) elsewhere.              |

## Groups

| Slug         | Name       | Auto-approve | Owner |
| ------------ | ---------- | ------------ | ----- |
| `golang`     | Go         | ✅           | alice |
| `react`      | React      | ❌           | bob   |
| `kubernetes` | Kubernetes | ✅           | carol |
| `python`     | Python     | ✅           | dave  |
| `devops`     | DevOps     | ❌           | eve   |

## Membership matrix

`role/status` for each user × group. Use this to pick a user/group combo
for any scenario without rereading the seed source.

| User      | golang             | react              | kubernetes          | python            | devops             |
| --------- | ------------------ | ------------------ | ------------------- | ----------------- | ------------------ |
| **alice** | owner / approved   | member / approved  | moderator / approved | member / approved | member / approved  |
| **bob**   | member / approved  | owner / approved   | member / approved   | member / pending  | moderator / approved |
| **carol** | moderator / approved | member / approved  | owner / approved    | member / approved | member / pending   |
| **dave**  | member / pending   | moderator / approved | member / approved   | owner / approved  | member / approved  |
| **eve**   | member / rejected  | member / pending   | member / pending    | member / approved | owner / approved   |

## Edge-case fixtures

Named scenarios planted for e2e and manual targeting:

- **Pending application awaiting moderator review** — sign in as
  `eve@example.com`, visit `/g/react`. Eve's row in `react` is `pending`,
  and `dave` (react moderator) can approve/reject from the moderation UI.
- **Rejected applicant** — `eve` in `golang` (`status: rejected`).
- **Mixed-state user** — `eve` covers all four states across groups
  (`approved`, `pending`, `rejected`, `owner`).
- **Net-negative answer with mixed votes** — `seed-a-golang-01-2` has
  `dave -1`, `carol -1`, `alice +1` → net `-1`.
- **Strongly-negative answer** — `seed-a-golang-06-2` has two downvotes
  and zero upvotes → net `-2`.
- **Accepted answer that is also downvoted** — `seed-a-react-01-1` is
  the accepted answer on `seed-q-react-01` and carries one downvote
  alongside two upvotes (good for testing "accepted + contested" UI).

## Notification fixtures

The seed creates one `question.created` notification per
question-recipient pair, where recipients are approved members of the
group excluding the author — mirroring `notifyQuestionCreated()` in
[`src/lib/notifications.ts`](../src/lib/notifications.ts).

- Total: **140 rows** (50 questions × ~3 approved non-author recipients).
- **alice + carol**: every notification marked read (`readAt` set to
  2026-05-01). Use to verify the empty-unread bell state and
  `markAllRead` no-op.
- **bob, dave, eve**: every notification unread. Use to verify the bell
  badge count, polling, mark-read, and mark-all-read flows.

## Search keywords planted for FTS testing

The query layer in [`src/lib/search.ts`](../src/lib/search.ts) uses SQLite
FTS5 with `porter unicode61 remove_diacritics 2` and prefix matching on
the trailing token. Keywords below appear in multiple groups so the scope
toggle (`current` vs `all`) returns visibly different result counts.

| Query              | Where it appears                                       | Why                                |
| ------------------ | ------------------------------------------------------ | ---------------------------------- |
| `sync pool`        | golang (3 questions), devops (1)                       | cross-group multi-match            |
| `context cancellation` | golang, kubernetes, python                          | cross-group multi-match            |
| `react server component` | react (1 question + 2 answers)                     | exact phrase, single group         |
| `kubernetes ingress` | kubernetes (2)                                       | exact phrase, single group         |
| `python asyncio`   | python (2)                                            | exact phrase, single group         |
| `terraform plan`   | devops (3)                                            | exact phrase, single group         |
| `gener`            | golang, kubernetes, python, devops                    | prefix → generic / generation / generator |
| `café`             | `seed-q-golang-10`                                    | diacritic — should match via `cafe` too |
| `naïve`            | `seed-q-react-10`                                     | diacritic                          |

## Idempotency

Every entity is `upsert`-ed by deterministic `seed-*` ID. Running
`npm run db:seed` against an already-seeded DB produces no new rows and
no errors — diff the printed counts before/after to confirm.

The seed is **non-destructive**: it does not delete rows you've added
manually. Use `npm run db:reset` if you need a clean wipe.

## What is not seeded

- **Other notification types.** The app currently only emits
  `question.created`; seeding any other `type` would create rows the bell
  UI can't render. Extend [`src/lib/notifications.ts`](../src/lib/notifications.ts)
  first, then add fixtures here.
- **Notifications for pending/rejected members.** Fan-out is restricted
  to approved members, matching the runtime helper.
- **Authored content from non-approved members.** Questions and answers
  in the seed are always written by approved members of the relevant
  group — keeps fixtures realistic for moderation UI testing.
- **Vote/favorite coverage on every question.** Many questions have no
  votes or favorites; if you need denser interactions, add them to the
  `votes` / `favorites` arrays in `seed.ts` rather than mutating the DB
  directly.

For schema-level details (field types, indexes, FK rules) see
[`schema.prisma`](schema.prisma).
