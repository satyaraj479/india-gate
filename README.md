# India Gate

Ordering, catering, table reservations and Gate Points for **India Gate**, a
South Indian restaurant in Little India, Singapore.

One Turborepo covering the web app, a mobile app and the platform API.

> **Status: prototype.** The web app is complete and runs today against a
> bundled menu. The API and mobile app are scaffolded from the architecture
> doc, not yet built out. Nothing here has taken a real payment.

---

## Try it in two minutes

```bash
pnpm install --filter @indiagate/web...
pnpm --filter @indiagate/web dev          # http://localhost:3000
```

No `.env` needed. The menu ships in the repo and a cash-on-delivery order
completes end to end — browse, customise a dosa, apply a promo code, check out,
see the receipt.

Use the `--filter`. A plain `pnpm install` also pulls NestJS and Expo for the
other two apps, which is several minutes you don't need.

**Things worth clicking**

- A dosa's **Customise** dialog — spice level and preparation are required, so
  "Add to cart" points you at what is missing rather than sitting disabled.
- Add the same dosa twice at Medium: it merges into one line at quantity 2. Add
  it again at Mild and it stays a separate line.
- The postcode box in the header: `218123` is the core zone, `238823` is
  central, `718123` is out of range and offers self-pickup instead.
- Promo codes `GATE15`, `FREEDEL`, `DUM10`, `PICKUP5`. Apply `GATE15` at S$40
  then remove items until you drop under S$30 — it falls off by itself.
- Resize to phone width. The cart drawer and customise sheet dock to the
  bottom, and the drawer's footer stays put while only the item list scrolls.

---

## Layout

| Path | What it is | State |
|---|---|---|
| `apps/web` | Next.js 14 App Router — the ordering site | **Built** |
| `apps/api` | NestJS + Fastify platform API | Scaffold |
| `apps/mobile` | Expo SDK 51 + expo-router | Scaffold |
| `packages/core` | Pure domain logic — pricing, catering quotes, loyalty, time | **Built + tested** |
| `packages/database` | Prisma schema and migrations | Schema complete |
| `packages/contracts` | `openapi.yaml`, generated types, Zod request schemas | Spec complete |
| `packages/queries` | React Query hooks shared by web and mobile | Scaffold |
| `packages/ui` | Design tokens and formatters | Scaffold |

`docs/ARCHITECTURE.md` is the design document: data model, concurrency,
payments, and the reasoning behind the code-sharing split. Start there if you
want the why. `apps/web/README.md` is the working guide for the site itself.

---

## Deploying the web app

Connect this repo to [Vercel](https://vercel.com/new) and set:

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| **Root Directory** | `apps/web` |
| Include files outside root directory | **on** (needed for `packages/core`) |
| Install command | *leave default* — Vercel installs at the workspace root |

That last pair is the only thing that usually trips people up: this is a pnpm
workspace, and `apps/web` depends on `@indiagate/core`, so a build scoped
strictly to `apps/web` cannot resolve it.

No environment variables are required for a first deploy. Add the Stripe keys
from `apps/web/.env.example` when you want card payment; without them the app
offers cash on delivery and says so plainly.

---

## Conventions that are not negotiable

- **Money is an integer number of cents**, with a `Cents` suffix. No floats.
- **Times of day are minutes from local midnight**, never a UTC instant the
  client re-derives with the device clock.
- **Order rows snapshot the catalog.** Nothing that renders a receipt joins to
  a live product row.
- **Pricing lives in `packages/core` only.** If you are about to compute a
  total in a component, stop.
- **The server reprices every checkout.** The client sends dish ids and option
  ids, never a price.

---

## Commands

```bash
pnpm --filter @indiagate/web dev
pnpm --filter @indiagate/web build
pnpm --filter @indiagate/web test        # 23 tests — pricing, coupons, serviceability
pnpm --filter @indiagate/core test       # 19 tests — money, catering quotes
pnpm --filter @indiagate/web typecheck
```

## Known gaps

These are deliberate and documented, not oversights:

- **Orders are not persisted.** `apps/web/src/lib/orders/store.ts` keeps them
  in memory. The confirmation page falls back to a signed cookie so a
  serverless deploy still shows a receipt, but restarting the server loses
  every order. Replace `InMemoryOrderStore` with the platform API before this
  takes a real order.
- **No authentication.** Guest checkout only.
- **Reservation availability is generated**, not read from a real floor plan.
  The two-phase hold that makes booking safe under concurrency is specified in
  `docs/ARCHITECTURE.md` and implemented in `apps/api`, not in the web app.
- **Dish photography is missing.** Cards render a generated monogram plate
  keyed off the dish name until real photos land.
