# India Gate — where things stand

_Last updated: 30 Aug 2026_

## Current state

The **web app is built and working**. Everything else is scaffolding against
the design in `docs/ARCHITECTURE.md`.

| Part | State |
|---|---|
| `apps/web` — Next.js 14 ordering site | Built. Build, typecheck and 23 tests pass. |
| `packages/core` — pricing, catering quotes, loyalty | Built. 19 tests pass. |
| `packages/database` — Prisma schema | Schema complete, validates clean. No migrations run. |
| `packages/contracts` — OpenAPI 3.1 | Spec complete and valid. Client not generated. |
| `apps/api` — NestJS | Scaffold. Architecture plus one reference service only. |
| `apps/mobile` — Expo | Scaffold. Metro config and dependencies only. |

## Running it

```bash
pnpm install --filter @indiagate/web...
pnpm --filter @indiagate/web dev          # http://localhost:3000
```

**Use the filter.** A bare `pnpm install` or `pnpm build` at the repo root
tries to build the API and mobile scaffolds, which have no source yet, and
fails. That is the one trap in this repo.

No `.env` is needed. The menu ships in the repo and a cash-on-delivery order
completes end to end.

## Decisions already taken

- **Backend:** NestJS + Prisma rather than Supabase. Reservation holds, stock
  decrements and catering-day counters need multi-statement transactions with
  conditional updates; an RLS-only model gets painful fast.
- **API style:** REST + OpenAPI as the public contract, tRPC internally.
- **Menu source:** a bundled typed catalog behind a `MenuRepository`
  interface, so the app runs with zero config. Swapping to the API is one
  adapter file, no component changes.
- **Payments:** Stripe implemented end to end behind a `PaymentProvider`
  interface; a Razorpay adapter sits at the same seam.
- **Web/mobile UI:** deliberately *not* sharing components. Share `core`,
  `contracts`, `queries` and design tokens; write the views twice. Reasoning
  in §6 of the architecture doc — this is the decision most likely to be
  revisited, so read that section before changing it.

## Not done yet

1. **Orders are not persisted.** `apps/web/src/lib/orders/store.ts` holds them
   in a module-level Map. The confirmation page falls back to a signed cookie
   so a serverless deploy still renders a receipt, but a restart loses
   everything. Replace `InMemoryOrderStore` before this takes a real order.
2. **Not deployed.** A Vercel attempt failed because Vercel ran
   `turbo run build` from the repo root and tried to build the two scaffold
   apps. Two fixes, neither applied:
   - Set **Root Directory = `apps/web`** in the Vercel project, with
     "include files outside root directory" on (needed for `@indiagate/core`).
   - Remove the unrunnable `build` / `test` scripts from `apps/api` and
     `apps/mobile`, and switch off `output: "standalone"` when
     `process.env.VERCEL` is set.
3. **No authentication.** Guest checkout only.
4. **Reservation availability is generated**, not read from a real floor plan.
   The two-phase hold that makes booking safe under concurrency is specified
   in the architecture doc and implemented in `apps/api`, not in the web app.
5. **No dish photography.** Cards render a generated monogram plate keyed off
   the dish name.

## Where to read next

- `apps/web/README.md` — the working guide for the site: structure, the
  conventions that are not negotiable, and how to test card payment locally.
- `docs/ARCHITECTURE.md` — the full design: data model, concurrency, payments,
  and why the code-sharing split is drawn where it is.
