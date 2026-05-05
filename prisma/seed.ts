import {
  PrismaClient,
  type Role,
  type MembershipStatus,
  type QuestionStatus,
  type TargetType,
} from "@prisma/client";

const prisma = new PrismaClient();

type SeedUser = { id: string; email: string; name: string };

const users: SeedUser[] = [
  { id: "seed-user-alice", email: "alice@example.com", name: "Alice Adams" },
  { id: "seed-user-bob", email: "bob@example.com", name: "Bob Brown" },
  { id: "seed-user-carol", email: "carol@example.com", name: "Carol Chen" },
  { id: "seed-user-dave", email: "dave@example.com", name: "Dave Davis" },
  { id: "seed-user-eve", email: "eve@example.com", name: "Eve Evans" },
];

type SeedGroup = {
  id: string;
  slug: string;
  name: string;
  description: string;
  autoApprove: boolean;
  createdById: string;
};

const groups: SeedGroup[] = [
  {
    id: "seed-group-golang",
    slug: "golang",
    name: "Go",
    description:
      "Discussion of the Go programming language, idioms, tooling, and the standard library.",
    autoApprove: true,
    createdById: "seed-user-alice",
  },
  {
    id: "seed-group-react",
    slug: "react",
    name: "React",
    description: "React, Next.js, and the broader frontend ecosystem.",
    autoApprove: false,
    createdById: "seed-user-bob",
  },
  {
    id: "seed-group-kubernetes",
    slug: "kubernetes",
    name: "Kubernetes",
    description: "Cluster operation, workloads, networking, and the ecosystem around Kubernetes.",
    autoApprove: true,
    createdById: "seed-user-carol",
  },
  {
    id: "seed-group-python",
    slug: "python",
    name: "Python",
    description: "Python language, packaging, async, scientific computing, and web frameworks.",
    autoApprove: true,
    createdById: "seed-user-dave",
  },
  {
    id: "seed-group-devops",
    slug: "devops",
    name: "DevOps",
    description: "CI/CD, IaC, observability, and platform engineering practice.",
    autoApprove: false,
    createdById: "seed-user-eve",
  },
];

type SeedMembership = {
  id: string;
  userId: string;
  groupId: string;
  role: Role;
  status: MembershipStatus;
};

const memberships: SeedMembership[] = [
  // Owners (creators)
  {
    id: "seed-mem-golang-alice",
    userId: "seed-user-alice",
    groupId: "seed-group-golang",
    role: "owner",
    status: "approved",
  },
  {
    id: "seed-mem-react-bob",
    userId: "seed-user-bob",
    groupId: "seed-group-react",
    role: "owner",
    status: "approved",
  },
  {
    id: "seed-mem-kubernetes-carol",
    userId: "seed-user-carol",
    groupId: "seed-group-kubernetes",
    role: "owner",
    status: "approved",
  },
  {
    id: "seed-mem-python-dave",
    userId: "seed-user-dave",
    groupId: "seed-group-python",
    role: "owner",
    status: "approved",
  },
  {
    id: "seed-mem-devops-eve",
    userId: "seed-user-eve",
    groupId: "seed-group-devops",
    role: "owner",
    status: "approved",
  },

  // golang cross-memberships
  {
    id: "seed-mem-golang-bob",
    userId: "seed-user-bob",
    groupId: "seed-group-golang",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-golang-carol",
    userId: "seed-user-carol",
    groupId: "seed-group-golang",
    role: "moderator",
    status: "approved",
  },
  {
    id: "seed-mem-golang-dave",
    userId: "seed-user-dave",
    groupId: "seed-group-golang",
    role: "member",
    status: "pending",
  },
  {
    id: "seed-mem-golang-eve",
    userId: "seed-user-eve",
    groupId: "seed-group-golang",
    role: "member",
    status: "rejected",
  },

  // react cross-memberships
  {
    id: "seed-mem-react-alice",
    userId: "seed-user-alice",
    groupId: "seed-group-react",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-react-carol",
    userId: "seed-user-carol",
    groupId: "seed-group-react",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-react-dave",
    userId: "seed-user-dave",
    groupId: "seed-group-react",
    role: "moderator",
    status: "approved",
  },
  {
    id: "seed-mem-react-eve",
    userId: "seed-user-eve",
    groupId: "seed-group-react",
    role: "member",
    status: "pending",
  },

  // kubernetes cross-memberships
  {
    id: "seed-mem-kubernetes-alice",
    userId: "seed-user-alice",
    groupId: "seed-group-kubernetes",
    role: "moderator",
    status: "approved",
  },
  {
    id: "seed-mem-kubernetes-bob",
    userId: "seed-user-bob",
    groupId: "seed-group-kubernetes",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-kubernetes-dave",
    userId: "seed-user-dave",
    groupId: "seed-group-kubernetes",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-kubernetes-eve",
    userId: "seed-user-eve",
    groupId: "seed-group-kubernetes",
    role: "member",
    status: "pending",
  },

  // python cross-memberships
  {
    id: "seed-mem-python-alice",
    userId: "seed-user-alice",
    groupId: "seed-group-python",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-python-bob",
    userId: "seed-user-bob",
    groupId: "seed-group-python",
    role: "member",
    status: "pending",
  },
  {
    id: "seed-mem-python-carol",
    userId: "seed-user-carol",
    groupId: "seed-group-python",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-python-eve",
    userId: "seed-user-eve",
    groupId: "seed-group-python",
    role: "member",
    status: "approved",
  },

  // devops cross-memberships
  {
    id: "seed-mem-devops-alice",
    userId: "seed-user-alice",
    groupId: "seed-group-devops",
    role: "member",
    status: "approved",
  },
  {
    id: "seed-mem-devops-bob",
    userId: "seed-user-bob",
    groupId: "seed-group-devops",
    role: "moderator",
    status: "approved",
  },
  {
    id: "seed-mem-devops-carol",
    userId: "seed-user-carol",
    groupId: "seed-group-devops",
    role: "member",
    status: "pending",
  },
  {
    id: "seed-mem-devops-dave",
    userId: "seed-user-dave",
    groupId: "seed-group-devops",
    role: "member",
    status: "approved",
  },
];

type SeedQuestion = {
  id: string;
  groupId: string;
  authorId: string;
  title: string;
  body: string;
  status: QuestionStatus;
  acceptAnswerId?: string;
};

const questions: SeedQuestion[] = [
  // golang (4)
  {
    id: "seed-q-golang-01",
    groupId: "seed-group-golang",
    authorId: "seed-user-bob",
    title: "When should I use a pointer receiver vs value receiver?",
    body: 'I keep flipping between the two. Is there a rule of thumb beyond "mutate => pointer"?',
    status: "answered",
    acceptAnswerId: "seed-a-golang-01-1",
  },
  {
    id: "seed-q-golang-02",
    groupId: "seed-group-golang",
    authorId: "seed-user-carol",
    title: "Best way to structure errors with errors.Is/As?",
    body: "Looking for an idiomatic pattern when wrapping errors across package boundaries.",
    status: "answered",
    acceptAnswerId: "seed-a-golang-02-1",
  },
  {
    id: "seed-q-golang-03",
    groupId: "seed-group-golang",
    authorId: "seed-user-alice",
    title: "Is sync.Pool worth using for short-lived buffers?",
    body: "Profiling shows allocator pressure but I've heard sync.Pool can be surprising.",
    status: "open",
  },
  {
    id: "seed-q-golang-04",
    groupId: "seed-group-golang",
    authorId: "seed-user-bob",
    title: "Generics: when do they actually pay off?",
    body: "Most of my code stays type-specific and reads fine. Where do generics genuinely help?",
    status: "open",
  },

  // react (4)
  {
    id: "seed-q-react-01",
    groupId: "seed-group-react",
    authorId: "seed-user-alice",
    title: "Server Components vs Client Components — mental model?",
    body: "How do you decide which side a component should live on in App Router?",
    status: "answered",
    acceptAnswerId: "seed-a-react-01-1",
  },
  {
    id: "seed-q-react-02",
    groupId: "seed-group-react",
    authorId: "seed-user-carol",
    title: "Suspense + data fetching: what's the current best practice?",
    body: "Lots of conflicting advice between RSC, TanStack Query, and route loaders.",
    status: "open",
  },
  {
    id: "seed-q-react-03",
    groupId: "seed-group-react",
    authorId: "seed-user-dave",
    title: "Form state: useActionState vs react-hook-form?",
    body: "Trying to pick a default for a new app — leaning toward useActionState but unsure.",
    status: "answered",
    acceptAnswerId: "seed-a-react-03-1",
  },
  {
    id: "seed-q-react-04",
    groupId: "seed-group-react",
    authorId: "seed-user-bob",
    title: "How are folks typing component refs in React 19?",
    body: "ref-as-prop changes some patterns. What's the cleanest typed signature?",
    status: "open",
  },

  // kubernetes (4)
  {
    id: "seed-q-kubernetes-01",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-alice",
    title: "When should a workload be a StatefulSet vs Deployment?",
    body: 'Aside from "needs stable identity" — what subtler signals push you to StatefulSet?',
    status: "answered",
    acceptAnswerId: "seed-a-kubernetes-01-1",
  },
  {
    id: "seed-q-kubernetes-02",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-bob",
    title: "Best pattern for short-lived job orchestration?",
    body: "CronJobs feel awkward for one-off tasks. What does everyone reach for?",
    status: "open",
  },
  {
    id: "seed-q-kubernetes-03",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-carol",
    title: "How do you keep namespace YAML drift in check?",
    body: "We have ~30 namespaces and config keeps diverging. ArgoCD? Kustomize bases? Both?",
    status: "answered",
    acceptAnswerId: "seed-a-kubernetes-03-1",
  },
  {
    id: "seed-q-kubernetes-04",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-dave",
    title: "Realistic resource requests/limits without overprovisioning",
    body: "VPA recommendations look high. How do you tune?",
    status: "open",
  },

  // python (4)
  {
    id: "seed-q-python-01",
    groupId: "seed-group-python",
    authorId: "seed-user-alice",
    title: "uv vs pip-tools vs poetry in 2026?",
    body: "What's the current sweet spot for app (not library) packaging?",
    status: "answered",
    acceptAnswerId: "seed-a-python-01-1",
  },
  {
    id: "seed-q-python-02",
    groupId: "seed-group-python",
    authorId: "seed-user-carol",
    title: "Async generators that wrap blocking IO — gotchas?",
    body: "Mixing run_in_executor with async iterators feels fragile. Patterns?",
    status: "open",
  },
  {
    id: "seed-q-python-03",
    groupId: "seed-group-python",
    authorId: "seed-user-eve",
    title: "Typing Protocols vs ABCs — when do you use which?",
    body: "Both work. I want a defensible heuristic for code review.",
    status: "answered",
    acceptAnswerId: "seed-a-python-03-1",
  },
  {
    id: "seed-q-python-04",
    groupId: "seed-group-python",
    authorId: "seed-user-dave",
    title: "FastAPI dependency injection for testability",
    body: "Override patterns, lifespan, scoped sessions — what's the cleanest setup?",
    status: "open",
  },

  // devops (4)
  {
    id: "seed-q-devops-01",
    groupId: "seed-group-devops",
    authorId: "seed-user-alice",
    title: "Terraform module boundaries — by service or by env?",
    body: "Currently we split by env; team is pushing for per-service modules. Tradeoffs?",
    status: "answered",
    acceptAnswerId: "seed-a-devops-01-1",
  },
  {
    id: "seed-q-devops-02",
    groupId: "seed-group-devops",
    authorId: "seed-user-bob",
    title: "How are folks doing PR-environment teardown reliably?",
    body: "Orphans pile up. We've tried TTL labels but they leak.",
    status: "open",
  },
  {
    id: "seed-q-devops-03",
    groupId: "seed-group-devops",
    authorId: "seed-user-dave",
    title: "OpenTelemetry collector: agent vs gateway?",
    body: "Looking for a default deployment topology that scales with the team.",
    status: "answered",
    acceptAnswerId: "seed-a-devops-03-1",
  },
  {
    id: "seed-q-devops-04",
    groupId: "seed-group-devops",
    authorId: "seed-user-eve",
    title: "Secret rotation without downtime — playbook?",
    body: "Step-by-step for rotating a DB password used by ~10 services.",
    status: "open",
  },

  // -----------------------------------------------------------------------
  // Volume + search-keyword fixtures (questions 05..10 in each group).
  // Repeated phrases ("sync pool", "context cancellation", "react server
  // component", "kubernetes ingress", "python asyncio", "terraform plan")
  // appear across multiple groups so the search scope toggle has visibly
  // different result counts. Diacritics ("café", "naïve") and prefix-match
  // tokens ("generic", "generation", "generator") exercise the FTS tokenizer.
  // -----------------------------------------------------------------------

  // golang (additional)
  {
    id: "seed-q-golang-05",
    groupId: "seed-group-golang",
    authorId: "seed-user-carol",
    title: "How does context cancellation propagate through goroutines?",
    body: "Looking for a clean pattern for fan-out goroutines that all need to honor context cancellation when the request is dropped.",
    status: "answered",
    acceptAnswerId: "seed-a-golang-05-1",
  },
  {
    id: "seed-q-golang-06",
    groupId: "seed-group-golang",
    authorId: "seed-user-bob",
    title: "sync pool vs custom buffer pool — when does it actually pay?",
    body: "Profiling shows allocator pressure. sync pool is tempting but I've heard the GC interaction is subtle.",
    status: "answered",
    acceptAnswerId: "seed-a-golang-06-1",
  },
  {
    id: "seed-q-golang-07",
    groupId: "seed-group-golang",
    authorId: "seed-user-alice",
    title: "Generators and lazy sequences via channels",
    body: "Coming from Python, I want generator-style iteration. Is a channel + goroutine the idiomatic Go answer?",
    status: "open",
  },
  {
    id: "seed-q-golang-08",
    groupId: "seed-group-golang",
    authorId: "seed-user-bob",
    title: "Profiling allocator pressure: pprof tips",
    body: "What flags and views do you reach for first when allocations are too high?",
    status: "answered",
    acceptAnswerId: "seed-a-golang-08-1",
  },
  {
    id: "seed-q-golang-09",
    groupId: "seed-group-golang",
    authorId: "seed-user-carol",
    title: "Designing generic container types in Go 1.21+",
    body: "When does it make sense to write a generic container vs reaching for a stdlib type?",
    status: "answered",
    acceptAnswerId: "seed-a-golang-09-1",
  },
  {
    id: "seed-q-golang-10",
    groupId: "seed-group-golang",
    authorId: "seed-user-bob",
    title: "café latency: tracing slow handlers in net/http",
    body: "We have a /café endpoint with intermittent p99 spikes. What's the right way to instrument it without redeploying?",
    status: "open",
  },

  // react (additional)
  {
    id: "seed-q-react-05",
    groupId: "seed-group-react",
    authorId: "seed-user-carol",
    title: "React server component data fetching patterns",
    body: "What's the canonical react server component data fetching pattern when the same data is needed by a client island below it?",
    status: "answered",
    acceptAnswerId: "seed-a-react-05-1",
  },
  {
    id: "seed-q-react-06",
    groupId: "seed-group-react",
    authorId: "seed-user-alice",
    title: "When to break out a server component into a route handler",
    body: "I keep finding myself wanting a JSON endpoint anyway. What's the heuristic?",
    status: "open",
  },
  {
    id: "seed-q-react-07",
    groupId: "seed-group-react",
    authorId: "seed-user-dave",
    title: "Code generation for typed API clients in Next.js",
    body: "Looking at openapi-typescript, kubb, and hand-rolled. Anyone landed on a generation pipeline they like?",
    status: "answered",
    acceptAnswerId: "seed-a-react-07-1",
  },
  {
    id: "seed-q-react-08",
    groupId: "seed-group-react",
    authorId: "seed-user-bob",
    title: "Memoization vs server components for expensive renders",
    body: "Where's the line between useMemo on the client and just moving the computation server-side?",
    status: "answered",
    acceptAnswerId: "seed-a-react-08-1",
  },
  {
    id: "seed-q-react-09",
    groupId: "seed-group-react",
    authorId: "seed-user-carol",
    title: "Suspense boundaries and streaming HTML",
    body: "What's the right granularity for Suspense boundaries when streaming?",
    status: "open",
  },
  {
    id: "seed-q-react-10",
    groupId: "seed-group-react",
    authorId: "seed-user-alice",
    title: "naïve hashing for cache keys in RSC",
    body: "I'm using a naïve string concat as a cache key. What goes wrong at scale?",
    status: "open",
  },

  // kubernetes (additional)
  {
    id: "seed-q-kubernetes-05",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-bob",
    title: "Kubernetes ingress controller selection: nginx vs traefik vs envoy",
    body: "Picking a kubernetes ingress controller for a new platform. What's the 2026 default?",
    status: "answered",
    acceptAnswerId: "seed-a-kubernetes-05-1",
  },
  {
    id: "seed-q-kubernetes-06",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-alice",
    title: "Generic kubernetes ingress patterns for multi-tenant clusters",
    body: "Looking for a generic ingress topology that scales across teams without per-tenant controllers.",
    status: "open",
  },
  {
    id: "seed-q-kubernetes-07",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-dave",
    title: "Pod-level context cancellation on graceful shutdown",
    body: "How do you wire SIGTERM into context cancellation cleanly across language ecosystems?",
    status: "answered",
    acceptAnswerId: "seed-a-kubernetes-07-1",
  },
  {
    id: "seed-q-kubernetes-08",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-carol",
    title: "Sidecar containers vs init containers: decision matrix",
    body: "When does a sidecar make more sense than an init container for setup work?",
    status: "open",
  },
  {
    id: "seed-q-kubernetes-09",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-bob",
    title: "Operator generation tooling: kubebuilder vs operator-sdk",
    body: "Which generation pipeline are folks using for new operators in 2026?",
    status: "answered",
    acceptAnswerId: "seed-a-kubernetes-09-1",
  },
  {
    id: "seed-q-kubernetes-10",
    groupId: "seed-group-kubernetes",
    authorId: "seed-user-alice",
    title: "Network policies that don't lock you out",
    body: "What's a safe default-deny rollout that doesn't break dev access?",
    status: "open",
  },

  // python (additional)
  {
    id: "seed-q-python-05",
    groupId: "seed-group-python",
    authorId: "seed-user-alice",
    title: "Python asyncio cancellation scope nesting",
    body: "How do you reason about python asyncio cancellation when scopes are nested deeply?",
    status: "answered",
    acceptAnswerId: "seed-a-python-05-1",
  },
  {
    id: "seed-q-python-06",
    groupId: "seed-group-python",
    authorId: "seed-user-carol",
    title: "Python asyncio timeouts: why my context manager leaks tasks",
    body: "Hitting a case where context cancellation under timeout leaves child tasks dangling. Pattern I'm missing?",
    status: "open",
  },
  {
    id: "seed-q-python-07",
    groupId: "seed-group-python",
    authorId: "seed-user-dave",
    title: "Generic types vs Protocol generics in modern Python",
    body: "When does a generic class outperform a Protocol with type vars?",
    status: "answered",
    acceptAnswerId: "seed-a-python-07-1",
  },
  {
    id: "seed-q-python-08",
    groupId: "seed-group-python",
    authorId: "seed-user-eve",
    title: "PEP 695 generic syntax: when to migrate?",
    body: "Is the new generic syntax stable enough for production code, or wait?",
    status: "open",
  },
  {
    id: "seed-q-python-09",
    groupId: "seed-group-python",
    authorId: "seed-user-alice",
    title: "Generator-based pipelines vs async streams",
    body: "When does a generator pipeline beat asyncio.Queue for streaming work?",
    status: "open",
  },
  {
    id: "seed-q-python-10",
    groupId: "seed-group-python",
    authorId: "seed-user-carol",
    title: "Threading vs asyncio for CPU-bound work — actual numbers",
    body: "Has anyone benchmarked threading vs asyncio for mixed CPU/IO workloads recently?",
    status: "answered",
    acceptAnswerId: "seed-a-python-10-1",
  },

  // devops (additional)
  {
    id: "seed-q-devops-05",
    groupId: "seed-group-devops",
    authorId: "seed-user-bob",
    title: "terraform plan diff hygiene in CI",
    body: "Our terraform plan output is impossible to read in PRs. How are you scoping it?",
    status: "answered",
    acceptAnswerId: "seed-a-devops-05-1",
  },
  {
    id: "seed-q-devops-06",
    groupId: "seed-group-devops",
    authorId: "seed-user-alice",
    title: "Generic terraform module API design",
    body: "How do you keep a generic terraform plan output stable across module versions?",
    status: "open",
  },
  {
    id: "seed-q-devops-07",
    groupId: "seed-group-devops",
    authorId: "seed-user-dave",
    title: "OpenTelemetry context propagation across service mesh",
    body: "Where does context get lost most often, and what fixes are stable?",
    status: "answered",
    acceptAnswerId: "seed-a-devops-07-1",
  },
  {
    id: "seed-q-devops-08",
    groupId: "seed-group-devops",
    authorId: "seed-user-eve",
    title: "Zero-downtime database migrations playbook",
    body: "Step-by-step for online schema changes on Postgres at moderate scale.",
    status: "open",
  },
  {
    id: "seed-q-devops-09",
    groupId: "seed-group-devops",
    authorId: "seed-user-bob",
    title: "sync pool tuning for connection pools at scale",
    body: "Borrowing the sync pool idea from Go — how are folks tuning DB connection pools that aggressively?",
    status: "answered",
    acceptAnswerId: "seed-a-devops-09-1",
  },
  {
    id: "seed-q-devops-10",
    groupId: "seed-group-devops",
    authorId: "seed-user-dave",
    title: "Generation of SBOMs in CI pipelines",
    body: "What generation tooling produces SBOMs that auditors actually accept?",
    status: "open",
  },
];

type SeedAnswer = {
  id: string;
  questionId: string;
  authorId: string;
  body: string;
};

const answers: SeedAnswer[] = [
  // golang
  {
    id: "seed-a-golang-01-1",
    questionId: "seed-q-golang-01",
    authorId: "seed-user-alice",
    body: "Pick pointer receivers when the type is large or when any method on it mutates — and stay consistent across the whole type.",
  },
  {
    id: "seed-a-golang-01-2",
    questionId: "seed-q-golang-01",
    authorId: "seed-user-carol",
    body: "Also: if it embeds sync primitives, pointer receiver is non-negotiable to avoid copying the lock.",
  },
  {
    id: "seed-a-golang-02-1",
    questionId: "seed-q-golang-02",
    authorId: "seed-user-alice",
    body: "Define sentinel errors at package boundaries, wrap with %w, and document the errors callers can match on.",
  },
  {
    id: "seed-a-golang-03-1",
    questionId: "seed-q-golang-03",
    authorId: "seed-user-carol",
    body: "It can help, but only after you've measured. The pool isn't free and tuning is easy to get wrong.",
  },

  // react
  {
    id: "seed-a-react-01-1",
    questionId: "seed-q-react-01",
    authorId: "seed-user-bob",
    body: "Default to a Server Component. Drop to a Client Component only when you need state, effects, or browser APIs.",
  },
  {
    id: "seed-a-react-01-2",
    questionId: "seed-q-react-01",
    authorId: "seed-user-dave",
    body: "Treat the boundary as a network seam — minimize what crosses it.",
  },
  {
    id: "seed-a-react-03-1",
    questionId: "seed-q-react-03",
    authorId: "seed-user-bob",
    body: "useActionState is great for submit/result flows; bring in react-hook-form when you need rich field-level state.",
  },

  // kubernetes
  {
    id: "seed-a-kubernetes-01-1",
    questionId: "seed-q-kubernetes-01",
    authorId: "seed-user-bob",
    body: "Stable network identity, ordered rolling updates, or per-pod persistent volumes — any one of those tips it to StatefulSet.",
  },
  {
    id: "seed-a-kubernetes-03-1",
    questionId: "seed-q-kubernetes-03",
    authorId: "seed-user-alice",
    body: "Kustomize base + overlays per env, deployed with Argo. The drift just disappears.",
  },

  // python
  {
    id: "seed-a-python-01-1",
    questionId: "seed-q-python-01",
    authorId: "seed-user-carol",
    body: "uv has won this for apps in 2026 — fast, lockfile-first, and Poetry-compatible enough.",
  },
  {
    id: "seed-a-python-01-2",
    questionId: "seed-q-python-01",
    authorId: "seed-user-dave",
    body: "I still reach for poetry on libraries because of publishing ergonomics, but uv for apps.",
  },
  {
    id: "seed-a-python-03-1",
    questionId: "seed-q-python-03",
    authorId: "seed-user-alice",
    body: "Protocols when you want structural typing across code you don't own; ABCs when you want enforced inheritance and shared implementation.",
  },

  // devops
  {
    id: "seed-a-devops-01-1",
    questionId: "seed-q-devops-01",
    authorId: "seed-user-bob",
    body: "Per-service modules with env-specific tfvars scales better once you cross ~5 services.",
  },
  {
    id: "seed-a-devops-03-1",
    questionId: "seed-q-devops-03",
    authorId: "seed-user-alice",
    body: "Agent-per-node for collection, gateway for export. The split keeps blast radius small.",
  },

  // -----------------------------------------------------------------------
  // Additional answers paired with the volume questions above.
  // seed-a-golang-06-2 is intentionally net-negative (see votes section).
  // -----------------------------------------------------------------------

  // golang (additional)
  {
    id: "seed-a-golang-05-1",
    questionId: "seed-q-golang-05",
    authorId: "seed-user-alice",
    body: "Pass ctx as the first arg, derive child contexts per goroutine, and select on ctx.Done() inside any blocking op. Cancellation is just a closed channel under the hood.",
  },
  {
    id: "seed-a-golang-06-1",
    questionId: "seed-q-golang-06",
    authorId: "seed-user-carol",
    body: "sync pool wins when the same goroutine reuses the buffer many times in a tight loop. Across goroutines or with mixed sizes, a custom pool is usually clearer.",
  },
  {
    id: "seed-a-golang-06-2",
    questionId: "seed-q-golang-06",
    authorId: "seed-user-alice",
    body: "Honestly I'd skip the pool entirely until the allocator is the proven bottleneck.",
  },
  {
    id: "seed-a-golang-08-1",
    questionId: "seed-q-golang-08",
    authorId: "seed-user-carol",
    body: "Start with -alloc_objects in pprof, look at the flame graph, and only then reach for sync pool or arenas.",
  },
  {
    id: "seed-a-golang-09-1",
    questionId: "seed-q-golang-09",
    authorId: "seed-user-alice",
    body: "Generic containers pay off when callers would otherwise duplicate the same code or lose type safety. For one-off internal helpers, a concrete type is still simpler.",
  },

  // react (additional)
  {
    id: "seed-a-react-05-1",
    questionId: "seed-q-react-05",
    authorId: "seed-user-bob",
    body: "Fetch in the react server component, hand the data down as props, and let the client island re-fetch only what it owns. Don't share an in-memory cache across the boundary.",
  },
  {
    id: "seed-a-react-05-2",
    questionId: "seed-q-react-05",
    authorId: "seed-user-dave",
    body: "Or expose a tiny route handler the client island calls — sometimes that's clearer than threading props through.",
  },
  {
    id: "seed-a-react-07-1",
    questionId: "seed-q-react-07",
    authorId: "seed-user-bob",
    body: "openapi-typescript for type generation, a thin fetch wrapper for runtime. Tools that try to do both end up rigid.",
  },
  {
    id: "seed-a-react-08-1",
    questionId: "seed-q-react-08",
    authorId: "seed-user-alice",
    body: "If the input doesn't change between renders for the same user, hoist it to the server. useMemo is cheaper, but server work is free for the client.",
  },

  // kubernetes (additional)
  {
    id: "seed-a-kubernetes-05-1",
    questionId: "seed-q-kubernetes-05",
    authorId: "seed-user-alice",
    body: "Default to ingress-nginx unless you need traefik's middleware ergonomics or envoy's xDS hooks. The boring choice still works.",
  },
  {
    id: "seed-a-kubernetes-05-2",
    questionId: "seed-q-kubernetes-05",
    authorId: "seed-user-dave",
    body: "Envoy via Gateway API if you're greenfield — the API is converging and the controller story is finally stable.",
  },
  {
    id: "seed-a-kubernetes-07-1",
    questionId: "seed-q-kubernetes-07",
    authorId: "seed-user-carol",
    body: "Trap SIGTERM, trigger context cancellation on a top-level context, and let the request handlers exit on ctx.Done(). Match terminationGracePeriodSeconds to your slowest in-flight call.",
  },
  {
    id: "seed-a-kubernetes-09-1",
    questionId: "seed-q-kubernetes-09",
    authorId: "seed-user-carol",
    body: "kubebuilder for the generation pipeline, controller-runtime for the reconcile loop. operator-sdk wraps the same thing with extra opinions.",
  },

  // python (additional)
  {
    id: "seed-a-python-05-1",
    questionId: "seed-q-python-05",
    authorId: "seed-user-carol",
    body: "Use TaskGroup — nested cancellation is its whole job. Hand-rolling cancel scopes around create_task is where leaks come from.",
  },
  {
    id: "seed-a-python-07-1",
    questionId: "seed-q-python-07",
    authorId: "seed-user-alice",
    body: "Generic class when you own the inheritance chain; Protocol with type vars when you want structural typing across third-party types.",
  },
  {
    id: "seed-a-python-10-1",
    questionId: "seed-q-python-10",
    authorId: "seed-user-eve",
    body: "Threads still win for CPU-bound under the GIL-removal builds; asyncio is for IO. Mixed workloads need run_in_executor at the boundary.",
  },

  // devops (additional)
  {
    id: "seed-a-devops-05-1",
    questionId: "seed-q-devops-05",
    authorId: "seed-user-alice",
    body: "Run terraform plan against a known good state file and post only the resource diff in PR comments. Atlantis handles this out of the box.",
  },
  {
    id: "seed-a-devops-05-2",
    questionId: "seed-q-devops-05",
    authorId: "seed-user-dave",
    body: "We pipe terraform plan through tfsec + a custom diff trimmer. Anything matching a stable allowlist is collapsed.",
  },
  {
    id: "seed-a-devops-07-1",
    questionId: "seed-q-devops-07",
    authorId: "seed-user-alice",
    body: "Mesh-injected sidecars usually drop context across protocol boundaries (HTTP→gRPC). Pin to W3C tracecontext on every hop and stop relying on B3.",
  },
  {
    id: "seed-a-devops-09-1",
    questionId: "seed-q-devops-09",
    authorId: "seed-user-eve",
    body: "Treat the connection pool like a sync pool: warm it eagerly, cap it well below DB max_connections, and recycle on idle.",
  },
];

type SeedVote = {
  id: string;
  userId: string;
  targetType: TargetType;
  targetId: string;
  value: number;
};

const votes: SeedVote[] = [
  // upvotes on accepted answers
  {
    id: "seed-v-a-golang-01-1-bob",
    userId: "seed-user-bob",
    targetType: "answer",
    targetId: "seed-a-golang-01-1",
    value: 1,
  },
  {
    id: "seed-v-a-golang-01-1-carol",
    userId: "seed-user-carol",
    targetType: "answer",
    targetId: "seed-a-golang-01-1",
    value: 1,
  },
  {
    id: "seed-v-a-react-01-1-alice",
    userId: "seed-user-alice",
    targetType: "answer",
    targetId: "seed-a-react-01-1",
    value: 1,
  },
  {
    id: "seed-v-a-react-01-1-carol",
    userId: "seed-user-carol",
    targetType: "answer",
    targetId: "seed-a-react-01-1",
    value: 1,
  },
  {
    id: "seed-v-a-kubernetes-01-1-alice",
    userId: "seed-user-alice",
    targetType: "answer",
    targetId: "seed-a-kubernetes-01-1",
    value: 1,
  },
  {
    id: "seed-v-a-python-01-1-alice",
    userId: "seed-user-alice",
    targetType: "answer",
    targetId: "seed-a-python-01-1",
    value: 1,
  },
  {
    id: "seed-v-a-python-01-1-eve",
    userId: "seed-user-eve",
    targetType: "answer",
    targetId: "seed-a-python-01-1",
    value: 1,
  },
  {
    id: "seed-v-a-devops-01-1-alice",
    userId: "seed-user-alice",
    targetType: "answer",
    targetId: "seed-a-devops-01-1",
    value: 1,
  },

  // upvotes on questions
  {
    id: "seed-v-q-golang-01-carol",
    userId: "seed-user-carol",
    targetType: "question",
    targetId: "seed-q-golang-01",
    value: 1,
  },
  {
    id: "seed-v-q-golang-04-alice",
    userId: "seed-user-alice",
    targetType: "question",
    targetId: "seed-q-golang-04",
    value: 1,
  },
  {
    id: "seed-v-q-react-02-alice",
    userId: "seed-user-alice",
    targetType: "question",
    targetId: "seed-q-react-02",
    value: 1,
  },
  {
    id: "seed-v-q-react-02-bob",
    userId: "seed-user-bob",
    targetType: "question",
    targetId: "seed-q-react-02",
    value: 1,
  },
  {
    id: "seed-v-q-kubernetes-02-carol",
    userId: "seed-user-carol",
    targetType: "question",
    targetId: "seed-q-kubernetes-02",
    value: 1,
  },
  {
    id: "seed-v-q-kubernetes-04-bob",
    userId: "seed-user-bob",
    targetType: "question",
    targetId: "seed-q-kubernetes-04",
    value: 1,
  },
  {
    id: "seed-v-q-python-02-dave",
    userId: "seed-user-dave",
    targetType: "question",
    targetId: "seed-q-python-02",
    value: 1,
  },
  {
    id: "seed-v-q-python-04-carol",
    userId: "seed-user-carol",
    targetType: "question",
    targetId: "seed-q-python-04",
    value: 1,
  },
  {
    id: "seed-v-q-devops-02-eve",
    userId: "seed-user-eve",
    targetType: "question",
    targetId: "seed-q-devops-02",
    value: 1,
  },
  {
    id: "seed-v-q-devops-04-bob",
    userId: "seed-user-bob",
    targetType: "question",
    targetId: "seed-q-devops-04",
    value: 1,
  },

  // a few downvotes to exercise -1 path
  {
    id: "seed-v-a-golang-01-2-dave",
    userId: "seed-user-dave",
    targetType: "answer",
    targetId: "seed-a-golang-01-2",
    value: -1,
  },
  {
    id: "seed-v-a-python-01-2-bob",
    userId: "seed-user-bob",
    targetType: "answer",
    targetId: "seed-a-python-01-2",
    value: -1,
  },

  // -----------------------------------------------------------------------
  // Edge-case fixtures (named for e2e/manual targeting):
  //
  // 1. Net-negative answer with mixed votes:
  //    seed-a-golang-01-2 picks up a second downvote from carol and one
  //    upvote from alice. Combined with the existing dave -1, final tally
  //    is -1 (dave -1, carol -1, alice +1).
  // 2. Accepted answer that is also downvoted:
  //    seed-a-react-01-1 (the accepted answer on react-01) gets a -1 from
  //    dave so the UI must show "accepted + contested".
  // 3. Strongly net-negative fresh answer:
  //    seed-a-golang-06-2 collects two downvotes (alice + carol) for a
  //    clean -2 with no upvotes — useful for sort/score testing.
  // -----------------------------------------------------------------------
  {
    id: "seed-v-a-golang-01-2-carol",
    userId: "seed-user-carol",
    targetType: "answer",
    targetId: "seed-a-golang-01-2",
    value: -1,
  },
  {
    id: "seed-v-a-golang-01-2-alice",
    userId: "seed-user-alice",
    targetType: "answer",
    targetId: "seed-a-golang-01-2",
    value: 1,
  },
  {
    id: "seed-v-a-react-01-1-dave",
    userId: "seed-user-dave",
    targetType: "answer",
    targetId: "seed-a-react-01-1",
    value: -1,
  },
  {
    id: "seed-v-a-golang-06-2-alice",
    userId: "seed-user-alice",
    targetType: "answer",
    targetId: "seed-a-golang-06-2",
    value: -1,
  },
  {
    id: "seed-v-a-golang-06-2-carol",
    userId: "seed-user-carol",
    targetType: "answer",
    targetId: "seed-a-golang-06-2",
    value: -1,
  },
];

type SeedFavorite = {
  id: string;
  userId: string;
  targetType: TargetType;
  targetId: string;
};

const favorites: SeedFavorite[] = [
  {
    id: "seed-f-q-golang-01-bob",
    userId: "seed-user-bob",
    targetType: "question",
    targetId: "seed-q-golang-01",
  },
  {
    id: "seed-f-q-react-02-alice",
    userId: "seed-user-alice",
    targetType: "question",
    targetId: "seed-q-react-02",
  },
  {
    id: "seed-f-q-kubernetes-03-dave",
    userId: "seed-user-dave",
    targetType: "question",
    targetId: "seed-q-kubernetes-03",
  },
  {
    id: "seed-f-q-python-01-carol",
    userId: "seed-user-carol",
    targetType: "question",
    targetId: "seed-q-python-01",
  },
  {
    id: "seed-f-q-devops-04-bob",
    userId: "seed-user-bob",
    targetType: "question",
    targetId: "seed-q-devops-04",
  },
  {
    id: "seed-f-a-react-01-1-carol",
    userId: "seed-user-carol",
    targetType: "answer",
    targetId: "seed-a-react-01-1",
  },
  {
    id: "seed-f-a-kubernetes-03-1-bob",
    userId: "seed-user-bob",
    targetType: "answer",
    targetId: "seed-a-kubernetes-03-1",
  },
  {
    id: "seed-f-a-python-01-1-alice",
    userId: "seed-user-alice",
    targetType: "answer",
    targetId: "seed-a-python-01-1",
  },
  {
    id: "seed-f-a-devops-03-1-eve",
    userId: "seed-user-eve",
    targetType: "answer",
    targetId: "seed-a-devops-03-1",
  },
  {
    id: "seed-f-a-golang-02-1-dave",
    userId: "seed-user-dave",
    targetType: "answer",
    targetId: "seed-a-golang-02-1",
  },
];

// -----------------------------------------------------------------------
// Notifications: fanned out per question to every approved member of the
// question's group, excluding the author. Mirrors the runtime behavior of
// notifyQuestionCreated() in src/lib/notifications.ts. Re-declared here
// (instead of imported) because that module is server-only.
//
// Read/unread split for e2e/manual testing:
//   - alice + carol: every notification marked read (use to verify the
//     "no unread" UI state).
//   - bob, dave, eve: every notification unread (use to verify the bell
//     badge, polling, mark-read, and mark-all-read flows).
// -----------------------------------------------------------------------

type SeedQuestionCreatedPayload = {
  questionId: string;
  questionTitle: string;
  groupSlug: string;
  groupName: string;
  authorName: string | null;
};

type SeedNotification = {
  id: string;
  userId: string;
  type: "question.created";
  payload: string;
  readAt: Date | null;
};

const READ_USER_IDS = new Set(["seed-user-alice", "seed-user-carol"]);
const SEED_READ_AT = new Date("2026-05-01T00:00:00Z");

const notifications: SeedNotification[] = (() => {
  const out: SeedNotification[] = [];
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const userById = new Map(users.map((u) => [u.id, u]));
  for (const q of questions) {
    const group = groupById.get(q.groupId);
    const author = userById.get(q.authorId);
    if (!group || !author) continue;
    const recipients = memberships
      .filter(
        (m) => m.groupId === q.groupId && m.status === "approved" && m.userId !== q.authorId,
      )
      .map((m) => m.userId);
    const payload: SeedQuestionCreatedPayload = {
      questionId: q.id,
      questionTitle: q.title,
      groupSlug: group.slug,
      groupName: group.name,
      authorName: author.name,
    };
    const payloadJson = JSON.stringify(payload);
    for (const userId of recipients) {
      out.push({
        id: `seed-n-${q.id}-${userId}`,
        userId,
        type: "question.created",
        payload: payloadJson,
        readAt: READ_USER_IDS.has(userId) ? SEED_READ_AT : null,
      });
    }
  }
  return out;
})();

async function main() {
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: { id: u.id, email: u.email, name: u.name },
      update: { email: u.email, name: u.name },
    });
  }

  for (const g of groups) {
    await prisma.group.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        slug: g.slug,
        name: g.name,
        description: g.description,
        autoApprove: g.autoApprove,
        createdById: g.createdById,
      },
      update: {
        slug: g.slug,
        name: g.name,
        description: g.description,
        autoApprove: g.autoApprove,
      },
    });
  }

  for (const m of memberships) {
    await prisma.membership.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        userId: m.userId,
        groupId: m.groupId,
        role: m.role,
        status: m.status,
      },
      update: { role: m.role, status: m.status },
    });
  }

  // Pass 1: create questions without acceptedAnswerId so the answer FK can be set later.
  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        groupId: q.groupId,
        authorId: q.authorId,
        title: q.title,
        body: q.body,
        status: q.status,
      },
      update: {
        title: q.title,
        body: q.body,
        status: q.status,
      },
    });
  }

  for (const a of answers) {
    await prisma.answer.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        questionId: a.questionId,
        authorId: a.authorId,
        body: a.body,
      },
      update: { body: a.body },
    });
  }

  // Pass 2: now that answers exist, link acceptedAnswerId on questions that have one.
  for (const q of questions) {
    if (q.acceptAnswerId) {
      await prisma.question.update({
        where: { id: q.id },
        data: { acceptedAnswerId: q.acceptAnswerId },
      });
    }
  }

  for (const v of votes) {
    await prisma.vote.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        userId: v.userId,
        targetType: v.targetType,
        targetId: v.targetId,
        value: v.value,
      },
      update: { value: v.value },
    });
  }

  for (const f of favorites) {
    await prisma.favorite.upsert({
      where: { id: f.id },
      create: {
        id: f.id,
        userId: f.userId,
        targetType: f.targetType,
        targetId: f.targetId,
      },
      update: {},
    });
  }

  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        userId: n.userId,
        type: n.type,
        payload: n.payload,
        readAt: n.readAt,
      },
      update: { type: n.type, payload: n.payload, readAt: n.readAt },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    groups: await prisma.group.count(),
    memberships: await prisma.membership.count(),
    questions: await prisma.question.count(),
    answers: await prisma.answer.count(),
    votes: await prisma.vote.count(),
    favorites: await prisma.favorite.count(),
    notifications: await prisma.notification.count(),
  };

  console.log("Seed complete:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
