# India Gate — Platform Architecture

**Status:** proposed · **Version:** 1.0 · **Date:** 2026-08-30

A production architecture for a South Indian restaurant selling through four
channels: delivery, self-pickup, dine-in table reservations, and event
catering. Web (Next.js 14) and mobile (Expo) over one NestJS + PostgreSQL
backend, in one Turborepo.

---

## 1. The shape of the problem

Most "restaurant app" architectures fail on one of two things, and neither is
the menu screen.

**Capacity is a shared, contended, finite resource.** A 7:30 PM table, a
delivery slot on Deepavali, the last twenty pieces of mysore pak, a Saturday
that the kitchen can only cater three events on. Every one of these is a
counter that two users will try to decrement at the same moment. Read-then-write
across two round trips loses that race every busy Friday, and the failure is
invisible in testing and catastrophic in production — a guest who arrives to no
table does not come back.

**Catering is not a big order.** It is a quote with volume-banded per-head
pricing, a course-by-course selection contract, lead times, a deposit, a menu
lock date, and an amendment window. Modelling it as `Order` with
`quantity: 200` throws away every one of those and puts them in a spreadsheet
the sales team maintains by hand.

The design below is organised around those two facts. Everything else — auth,
catalog, payments — is well-trodden and treated as such.

---

## 2. Topology

```
                       ┌──────────────┐        ┌─────────────────┐
   iOS / Android ─────▶│              │        │  Next.js 14     │
   (Expo, EAS)         │  CloudFront  │───────▶│  App Router     │──┐
                       │   + WAF      │        │  (RSC + ISR)    │  │
   Desktop / m-web ───▶│              │        └─────────────────┘  │
                       └──────┬───────┘                             │
                              │                                     │
                              ▼                                     ▼
                     ┌─────────────────┐                  ┌──────────────────┐
                     │  NestJS API     │◀────────────────▶│  PostgreSQL 16   │
                     │  (Fastify)      │                  │  primary + read  │
                     │  modular        │                  │  replica         │
                     │  monolith       │                  └──────────────────┘
                     └────┬───────┬────┘                            ▲
                          │       │                                 │
              ┌───────────┘       └────────────┐                    │
              ▼                                ▼                    │
      ┌───────────────┐                ┌──────────────┐             │
      │ Socket.IO     │                │ BullMQ       │─────────────┘
      │ gateway       │                │ workers      │
      │ (Redis adptr) │                │ + outbox relay│
      └───────────────┘                └──────┬───────┘
                                              │
                    ┌─────────────────────────┼────────────────────────┐
                    ▼            ▼            ▼           ▼            ▼
                 Stripe /     Lalamove /   Twilio /    Expo Push   S3 + CDN
                 HitPay       Grab Exp.    WhatsApp
```

**A modular monolith, not microservices.** One deployable NestJS app with hard
module boundaries (`catalog`, `ordering`, `catering`, `reservations`,
`loyalty`, `delivery`, `identity`), each exposing a service interface and
owning its tables. Cross-module calls go through those interfaces, never
through another module's repository.

The honest reasoning: this is a restaurant group, not a marketplace. Peak load
is a few hundred concurrent users on a Friday evening. Microservices would buy
independent scaling nobody needs and cost distributed transactions across
order-payment-loyalty — the exact place where consistency matters most. The
module boundaries are drawn so that if catering or delivery ever *does* need to
split out, the seam already exists. Splitting a well-bounded monolith is a
week; un-splitting premature microservices is a quarter.

**The one thing that is separate** is the worker process. It runs the outbox
relay, the hold sweeper, the slot generator, notification dispatch and report
generation. It shares the codebase and deploys from the same image, but runs as
its own service so a stuck PDF render cannot starve the request path.

### Why NestJS + Prisma rather than Supabase

Supabase would have this shipping faster, and for a pure catalog-and-cart app
it would be the right call. It loses on the two hard problems above:

- The reservation hold, the stock decrement and the catering-day counter all
  need multi-statement transactions with conditional updates and application
  logic in between. In Supabase those become Postgres functions or Edge
  Functions — meaning the most intricate business logic in the system lives in
  SQL or in a runtime with a different deployment story, testing story and
  observability story from everything else.
- Authorization here is not row ownership. "A kitchen staffer at outlet A may
  advance an order's status but not refund it, unless it is a catering order in
  the ENQUIRY stage" is not an RLS policy anyone should maintain.

What is worth stealing from Supabase: use managed Postgres (RDS/Neon/Supabase's
own database product) rather than running it. The database is the thing you
least want to operate.

---

## 3. Data model

Full schema: [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma).
Validates clean against Prisma 6. The decisions worth defending:

### Money is an integer, always

Every amount is `Int` in minor units with a `currency` beside it. There is no
`Float`, no `Decimal` for money, and no field named `price` without a `Cents`
suffix. `Decimal` would be correct too, but integers make it impossible to
accidentally introduce a float through a JSON round-trip, and JavaScript is on
both ends of every wire here.

### Historical rows snapshot; they do not join

`OrderItem` copies `productName`, `variantName`, `unitPriceCents` and every
modifier's name and delta at the moment of purchase. Same for
`CateringSelection` and `Payment`.

This is the single most common production bug in restaurant software: the
kitchen renames "Chicken 65" to "Chicken 65 (Spicy)" and raises the price, and
every receipt ever issued now shows the new name and the new total. Refunds
reconcile against a number that no longer exists. Catalog rows are mutable
content; order rows are financial records. They must not share a source of
truth.

The catalog FK is kept alongside the snapshot, nullable with `onDelete:
SetNull`, purely for analytics joins.

### Prices live on variants, not products

"Half / Full", "Regular / Family Pack", "1kg handi / 2kg handi" are the same
dish at different prices. Putting price on `Product` forces a duplicate product
per size, which then needs duplicate images, duplicate descriptions and
duplicate modifier attachments — and the two drift.

`PriceOverride` then layers channel- and outlet-specific pricing on top,
because delivery prices are commonly 10–15% above dine-in to absorb aggregator
economics and finance will want to change that without a migration.

### Modifier groups are shared, with per-product overrides

`ModifierGroup` ("Spice Level") attaches to forty dishes via
`ProductModifierGroup`, which carries `isRequired` and min/max overrides. Spice
level is required on curries and optional on desserts without cloning the
group. Inlining modifiers per product triples the menu payload and guarantees
that "Extra ghee" costs $1.50 on one dish and $1.00 on another after someone
edits one copy.

### Status is a ledger, not a column

`OrderStatusEvent` is append-only. `Order.status` is a cache of the newest row.
This gives the tracking screen its timeline for free, gives support "who
cancelled this and when", and makes the KDS auditable. Same pattern for
`LoyaltyLedgerEntry` (points) and `StockMovement` (who 86'd the vada).

`LoyaltyAccount.balancePoints` is explicitly a **cache** of the ledger. A
nightly job re-derives it and alerts on drift. When they disagree, the ledger
wins.

### `SlotInventory` exists only to make booking correct

This is the load-bearing table. It materialises a counter per
`(outlet, service area, date, time, channel)` with `capacityPax`, `bookedPax`
and `heldPax`, generated nightly from the `ServiceSchedule` rules.

Availability could be computed on the fly from the schedule. It cannot be
*locked* on the fly. Section 4 covers what this buys.

### Catering extends `Order`; it does not duplicate it

`CateringOrder` holds a 1:1 FK to an `Order` of channel `CATERING`. Payments,
discounts, refunds, status history and the loyalty ledger all work unchanged. A
parallel `CateringBooking` table with its own payment and status columns means
every one of those features gets implemented twice and diverges.

The wizard itself is data, not code:

| Table | Role |
|---|---|
| `CateringPackage` | `minimumPax`, `paxStep`, lead time, deposit %, menu-lock window |
| `CateringPackageTier` | Volume bands — 30–59 @ $28/pax, 60–119 @ $24, 120+ @ $21 |
| `CateringCourse` | One wizard step: `stepIndex`, `minSelections`, `maxSelections`, `includedSelections` |
| `CateringCourseOption` | A dish inside a course, with `surchargePerPaxCents` for premium picks |
| `CateringAddOn` | Chafing dishes, staff, live counters — `PER_EVENT` / `PER_PAX` / `PER_UNIT` |

Adding a "Soups" step or changing "choose 3 starters" to "choose 4" is a
content edit. Neither requires an app release — which matters enormously,
because an App Store review sits between a code change and the guest's phone.

### Platform tables that pay for themselves

- **`OutboxEvent`** — domain writes and the event announcing them commit in one
  transaction; a relay publishes afterwards. Without it, "order paid" persists
  while the push notification is lost, or the push fires for a transaction that
  rolled back. Every socket event and every notification in this system
  originates here, never from application code emitting directly.
- **`IdempotencyRecord`** — stores the first response for every non-GET
  mutation. Mobile clients retry; guests double-tap.
- **`FeatureFlag`** with `minAppVersion` — server-side kill switch. When the
  catering wizard breaks on iOS, you turn it off in seconds rather than in a
  three-day review cycle.

---

## 4. Concurrency: the part that actually breaks

### Table reservations — two-phase hold

Implementation: [`apps/api/src/reservations/reservation-hold.service.ts`](../apps/api/src/reservations/reservation-hold.service.ts).

```sql
UPDATE slot_inventory
   SET held_pax = held_pax + :party
 WHERE id = :slot
   AND is_blocked = false
   AND starts_at > now()
   AND booked_pax + held_pax + :party <= capacity_pax;
```

One statement. Postgres takes a row lock for its duration; the second writer
either waits and then fails the `WHERE`, or fails immediately. Exactly one
booking wins and we learn which from the affected-row count. `READ COMMITTED` is
sufficient — correctness comes from the row lock, not the isolation level.

`heldPax` is separate from `bookedPax` because a guest needs 30–90 seconds to
type their name. Holding capacity for that window is the difference between
"sorry, that just went" on the *availability* screen (acceptable) and on the
*confirmation* screen (a lost booking and a furious guest). Holds expire in
8 minutes; a sweeper returns them every minute and is idempotent by
construction.

Confirmation moves covers from `heldPax` to `bookedPax` in a single statement
so a partial failure cannot decrement both or neither.

**Rejected alternatives.** `SELECT … FOR UPDATE` then `UPDATE`: correct, but an
extra round trip inside the lock for no benefit. A Redis lock on the slot:
introduces a second source of truth that can drift, and a lost key silently
reopens the race. `SERIALIZABLE` on the whole transaction: correct, but turns
every concurrent booking into a retry storm at peak.

### Delivery and pickup slots

Same table, same mechanism, different unit: `capacityOrders` / `bookedOrders`
rather than covers. This is what stops the kitchen accepting forty orders for
7:00 PM when it can plate twelve.

### Limited stock

`OutletProductAvailability.quantityRemaining` decrements under the same
conditional-update pattern inside the checkout transaction, with every movement
written to `StockMovement`. Items without a quantity (the common case) skip the
check entirely — only the genuinely limited items pay for it.

### Checkout

One transaction: re-price from live catalog → reserve stock → reserve slot →
write the coupon redemption (the `@@unique([couponId, orderId])` constraint is
what actually enforces the cap under concurrency, not the service's check) →
reserve points → create the order in `PENDING_PAYMENT` → enqueue the outbox
event.

If the re-price differs from what the client last displayed, the call returns
`409 checkout/price-changed` with the new cart and the guest re-confirms.
Silently repricing is how you get chargebacks.

**The order does not reach the kitchen here.** It transitions to `PLACED` on
the payment webhook, so a failed 3DS challenge never puts a ticket on the pass.

---

## 5. API contract

Full spec: [`packages/contracts/openapi.yaml`](../packages/contracts/openapi.yaml)
(OpenAPI 3.1, validates clean).

**REST + OpenAPI as the public contract, typed internally.** `openapi-typescript`
generates the client types; `openapi-fetch` (~2 KB, types erased at build time)
is the runtime. No client hand-writes a response interface, so a breaking server
change fails `turbo typecheck` in CI rather than at runtime on a guest's phone.

GraphQL was considered and set aside. The menu is the one place its selective
fetching would help, and that is solved better by shipping the whole menu as a
single cacheable document. Against that: caching a POST-shaped graph at the CDN
is work, rate limiting by query cost is work, and the delivery-partner and
payment integrations need a real OpenAPI document anyway. Maintaining both is
two sources of truth.

tRPC is used *inside* the API for service-to-service typing. The boundary drawn
is public-versus-internal, not web-versus-mobile.

### The endpoints that carry design weight

**`GET /outlets/{id}/menu?channel=`** returns the entire menu in one response —
categories, products, variants, and modifier groups **normalised out and sent
once**. Roughly 200 KB gzipped, `Cache-Control: public, max-age=60,
stale-while-revalidate=600` at the CDN with a strong ETag over the catalog
version plus the outlet's 86 state. Mobile persists it for offline browsing and
revalidates with `If-None-Match`. A category list plus N product calls would be
forty round trips on a 3G connection in a lift.

**`POST /catering/quote`** is a pure function — no rows written, no capacity
held. The wizard calls it on every step (debounced 400 ms) so the sticky-footer
total is always the server's number. Returns itemised `lines` *and* per-course
`validation`, so the client renders the breakdown and enables "Next" from the
same response.

**`POST /reservations/holds` → `POST /reservations`** is the two-phase booking
from §4. The 409 on a filled slot carries `alternatives` so the UI offers
nearby times inline instead of dumping the guest back to the calendar.

**Real-time is not REST.** Order tracking runs over Socket.IO
(`order:{orderId}`, `outlet:{id}:kds`, `user:{id}`), fed exclusively by the
outbox relay. `GET /orders/{id}/tracking` exists as the reconnect/backfill path
and is rate limited to one call per ten seconds — it is not a polling endpoint.
Driver location emits are throttled to one per five seconds and the client
interpolates between pings rather than snapping the marker.

### Cross-cutting rules

| Concern | Rule |
|---|---|
| Money | Integer minor units, `Cents` suffix, never a float |
| Time-of-day | Minutes from local midnight, never a UTC instant the client re-derives |
| Idempotency | `Idempotency-Key` required on every money- or capacity-creating POST |
| Concurrency | `If-Match` on mutations; 409 returns the current representation |
| Errors | RFC 9457 problem documents; `type` is a stable slug clients switch on |
| Pagination | Cursor-based — offsets break when the list mutates under the reader |

---

## 6. Code sharing between Next.js and Expo

```
india-gate/
├── apps/
│   ├── api/            NestJS + Fastify
│   ├── web/            Next.js 14 App Router
│   └── mobile/         Expo SDK 51 + expo-router
├── packages/
│   ├── database/       Prisma schema, migrations, seed  — API only
│   ├── core/           Pure domain logic                — everyone
│   ├── contracts/      openapi.yaml, generated types, Zod, API client
│   ├── queries/        React Query hooks                — web + mobile
│   ├── ui/             Design tokens + formatters       — web + mobile
│   └── config/         tsconfig + eslint presets
└── turbo.json
```

### What is shared, and why each layer earns its place

**`packages/core` — pure domain logic.** Cart pricing, the catering quote
engine, loyalty earn/redeem/FIFO-expiry, outlet-local time maths. One hard
rule, enforced by an ESLint `no-restricted-imports` rule rather than good
intentions: nothing here may import `react`, `next`, `react-native`,
`@prisma/client` or `node:*`, or touch `window`, `process.env`, `Date.now()` or
`Math.random()`. Everything is a pure function of its arguments, including the
clock.

That rule is the whole trick. It is what lets the identical `quoteCatering`
function run inside a NestJS transaction, a React Server Component and a Hermes
bundle. Reimplementing catering pricing in three places is how a guest is
quoted S$1,840 on the phone and charged S$1,910 on the card.

**`packages/contracts` — the wire.** `openapi.yaml` is the source of truth for
responses; Zod schemas are the source of truth for requests, and the API's
OpenAPI request bodies are generated *from* those Zod schemas at build time, so
the two cannot drift. Both apps use the same Zod schemas for form validation
via `@hookform/resolvers`, so a field's max length is defined once and enforced
in three places.

**`packages/queries` — server state.** This is where most of the genuine reuse
lives. Cache keys, staleness policy, optimistic updates, retry behaviour and
error mapping are identical across platforms, and they are the subtle parts. A
pixel of padding differing between web and mobile is fine; a cache key
differing is a stale menu after an outlet 86s an item.

Retry policy is shared and deliberate: never retry a 4xx. A rejected coupon
will not succeed on the second attempt, and retrying a 409 on checkout is
actively harmful.

### What is deliberately *not* shared: UI components

`packages/ui` exports design tokens, formatters and a few headless hooks. It
does **not** export a `<Button>` that renders on both platforms.

This is the load-bearing opinion in this section, and it runs against the
instinct that a monorepo should share everything. React Native Web or Tamagui
would let you write one component tree. What you get in exchange: a web app
whose bundle carries a React Native compatibility layer, whose accessibility
tree is synthesised rather than native, whose SEO story fights the framework
(catering and menu pages are the site's main organic acquisition channel — they
must be server-rendered semantic HTML), and whose every platform divergence
becomes a `Platform.OS` branch inside shared code.

The two surfaces also want genuinely different interfaces. Mobile ordering is a
thumb-driven bottom-sheet flow with haptics, native maps and push. Web catering
is a wide multi-column wizard someone fills in on a laptop while comparing
quotes. Forcing one component tree to serve both produces something that is
mediocre at each.

So: **share the logic, the contract, the cache and the tokens; write the views
twice.** The views are the cheap part and the part that most benefits from
being native to its platform. Roughly 60–70% of non-view code ends up shared,
which is where the real maintenance cost lives.

### Turborepo mechanics

- **pnpm**, not npm or yarn. Strict `node_modules` means a package that uses an
  undeclared transitive dependency fails locally rather than in the EAS build.
  (`node-linker=hoisted` in `.npmrc` because Metro's symlink handling is still
  inconsistent across Expo SDK versions — a pragmatic concession, revisit it.)
- **Workspace packages ship raw TypeScript**, not built `dist`. Next's
  `transpilePackages` and Metro's `watchFolders` compile them as source. No
  build step before `expo start`, and no stale-`dist` class of bug.
- **`turbo.json` task graph** with `dependsOn: ["^build"]`, precise `inputs`
  (so a change to `openapi.yaml` invalidates codegen and everything downstream,
  and a README edit invalidates nothing), and `outputs` for remote caching. CI
  on a docs-only PR finishes in under a minute.
- **`metro.config.js`** needs exactly three lines — `watchFolders`,
  `nodeModulesPaths`, `disableHierarchicalLookup` — and each exists because of a
  specific failure. They are commented in the file.

---

## 7. Payments

Provider-abstracted at the `PaymentIntent` envelope: clients branch on
`action` (`CONFIRM_ON_CLIENT` / `REDIRECT` / `DISPLAY_QR` / `POLL`), never on
the provider name. Singapore needs PayNow and GrabPay alongside cards, and
those have genuinely different client flows.

- **The webhook is the source of truth**, not the client's success callback. A
  client that closes the app after paying must still get their order.
- Webhooks are signature-verified, deduplicated on the provider event id
  (`Payment.providerPaymentId` is `UNIQUE`, so a replayed webhook is a no-op
  rather than a double capture), and **persisted raw before processing**. A
  provider that receives a 500 will hammer the endpoint; answer 200 fast and do
  the work on a queue.
- Card data never touches our servers. `SavedPaymentMethod` stores a provider
  vault token plus brand and last four.
- Catering takes a deposit (default 30%) at booking and the balance before the
  event. Both are `Payment` rows against the same order.

---

## 8. Real-time tracking

Socket.IO with the Redis adapter for fan-out across API instances. Channels and
events are documented in `x-realtime-channels` at the bottom of the OpenAPI
document, so there is one contract file rather than two.

Every event originates from the transactional outbox relay. Application code
never emits to a socket directly — that is what keeps the stream consistent
with the database, and it means a socket delivery failure is a retry rather
than a lost fact.

Driver location: in-house drivers push from the driver app to
`DriverLocationPing` (a time-series table, partitioned and rotated at ~7 days —
it is not a record of account). Third-party couriers give us a webhook and a
tracking URL; the tracking response exposes `trackingUrl` and the client falls
back to it rather than pretending to a precision we do not have.

---

## 9. Performance and caching

| Layer | Approach |
|---|---|
| Menu | CDN-cached with ETag; the single most-hit response in the system |
| Web marketing/menu pages | Next.js ISR with tag-based revalidation on catalog publish |
| Catering package pages | Statically generated, revalidated on publish — these are the organic-search entry points |
| Reads | Availability, menu and history queries hit a read replica; anything inside a booking or checkout transaction hits the primary |
| Session/rate limiting | Redis |
| Images | S3 + CloudFront, AVIF/WebP via `next/image` and `expo-image` |
| Mobile | Menu and past orders persisted with React Query's persister; the app opens usable offline |

---

## 10. Delivery, environments, releases

- **API and worker**: one Docker image, two services on ECS Fargate (or Fly.io
  at this scale). Blue/green with health checks.
- **Web**: Vercel, or the same ECS cluster via `output: "standalone"`.
- **Database**: managed Postgres 16 with PITR. Migrations run as a pre-deploy
  step and must be backwards-compatible with the running version — expand,
  migrate, contract, never a breaking change in one deploy.
- **Mobile**: EAS Build for store releases, **EAS Update for JS-only fixes**.
  This matters more than it sounds: an App Store review sits between a bug and
  your guests. Native changes go through the stores; everything else ships in
  minutes. `FeatureFlag.minAppVersion` is the complementary lever — turn a
  broken flow off server-side for old builds without shipping anything.
- **Environments**: `local` (docker-compose), `preview` (per-PR, ephemeral
  database), `staging`, `production`.
- **CI**: `turbo run lint typecheck test build` with remote caching, plus
  `redocly lint` on the OpenAPI document and `prisma migrate diff` to catch a
  schema change that arrived without a migration.

---

## 11. Security, privacy, compliance

- Phone-OTP as the primary auth (this market barely uses passwords), rate
  limited per phone and per IP. The OTP request endpoint returns 202
  unconditionally — it must not reveal whether an account exists.
- Access tokens are 15 minutes; refresh tokens are single-use and rotate within
  a `familyId`. Presenting an already-rotated token revokes the whole family.
  That is replay detection, not an edge case.
- RBAC in a Nest guard: `roles` plus `outletIds` on the JWT. Staff are scoped
  to their own outlets.
- **PDPA (Singapore)**: `User.anonymisedAt` drives a scrubbing job that
  clears PII while retaining order rows — financial records must survive a
  deletion request, personal data must not. `AuditLog` covers refunds, price
  changes and manual discounts. Marketing consent is stored per channel, not as
  one boolean.
- No card data, ever. No PAN, no CVV — vault tokens and last four only.

---

## 12. Observability

OpenTelemetry traces through API → database → queue. Structured logs (pino)
with a request id propagated to the socket layer and the workers. The alerts
that matter are business-level, not CPU-level:

- checkout failure rate by payment method
- orders stuck in `PLACED` for more than N minutes (the kitchen is not looking
  at the tablet)
- outbox events in `FAILED` or `DEAD_LETTER`
- loyalty balance drift between `LoyaltyAccount` and its ledger
- reservation no-show rate by outlet and slot

---

## 13. Suggested build order

1. **Foundation** — monorepo, Prisma schema, migrations, auth, outlet/menu
   admin, seed data.
2. **A la carte ordering** — menu, cart, checkout, one payment provider,
   pickup only. Get money moving end to end before adding channels.
3. **Delivery** — zones, slots, driver assignment, tracking socket.
4. **Reservations** — schedules, slot generation, hold/confirm, floor view.
5. **Catering** — packages, the wizard, quote engine, deposits, ops console.
6. **Gate Points** — earn, redeem, tiers, coupons, referrals.
7. **Mobile app** — reusing `core`, `contracts` and `queries` wholesale; the
   work is views, navigation and native integrations.

Catering deliberately lands after reservations even though it is the
differentiating feature. It has the most business rules and the most ops
involvement, and it benefits from the order and payment primitives being
already battle-tested.

---

## 14. Known risks

| Risk | Mitigation |
|---|---|
| Slot generation job fails silently → no bookable slots tomorrow | Alert on slot count per outlet per day falling below a floor; generate 90 days ahead so one failed night is invisible |
| Catering pricing rules outgrow the tier/course model | The engine is one pure function with a table of tests; a rules DSL can replace it behind the same interface |
| `heldPax` leaks if the sweeper stops | Sweeper heartbeat alert; a nightly reconciliation recomputes `heldPax` and `bookedPax` from reservation rows |
| The kitchen ignores the tablet | Stuck-order alert plus SMS escalation to the outlet manager. This is an operations failure that the software has to notice |
| Menu payload grows past a comfortable size | Split by category with per-category ETags — but only when measured, not pre-emptively |
| RN Web pressure ("why are we writing views twice?") | Revisit only if view code becomes a measured bottleneck. The 60–70% of shared non-view code is already where the maintenance cost lives |
