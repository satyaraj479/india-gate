# India Gate — Web

Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Zustand · Stripe

Dark navy (`#0A1128`) and warm gold (`#D4AF37`), built for desktop and mobile
web. Runs with no configuration: the menu ships in the repo and a
cash-on-delivery order completes end to end.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # optional — only for card payment
pnpm --filter @indiagate/web dev               # http://localhost:3000
```

## Pages

| Route | What it does |
|---|---|
| `/` | Landing — hero, three ordering paths, bestsellers, Gate Points |
| `/menu` | Ordering engine: category jump rail, search, dietary filter, dish cards, customise dialog |
| `/catering` | Bundle browsing with per-head pricing bands and an enquiry FAQ |
| `/reservations` | Date strip, party-size stepper, covers-based slot grid, booking confirmation |
| `/contact` | Address, hours, directions, enquiry form (deep-linked from catering) |
| `/checkout` | Details → payment, with server-side repricing |
| `/checkout/confirmation/[orderNumber]` | Receipt, collection code, points earned |
| `/api/checkout` | Creates the order and opens a payment intent |
| `/api/webhooks/payments` | Signature-verified gateway callback |

## Structure

```
src/
├── app/                      routes, route handlers, error + loading states
├── components/
│   ├── ui/                   shadcn primitives (button, dialog, sheet, …)
│   ├── layout/               header, fulfilment toggle, postcode modal, footer
│   ├── menu/                 dish card, customise dialog, category rail, badges
│   ├── cart/                 drawer, line row, quantity stepper, promo, summary
│   ├── checkout/             details form, Stripe payment step
│   ├── reservations/         booking form
│   └── contact/              enquiry form
├── hooks/                    use-cart-totals, use-hydrated, use-scroll-spy
├── lib/
│   ├── catalog/              MenuRepository + the bundled catalog
│   ├── checkout/reprice.ts   the security boundary — server-side pricing
│   ├── orders/store.ts       OrderStore interface + in-memory implementation
│   ├── payments/             PaymentProvider + Stripe and Razorpay adapters
│   ├── coupons.ts            promo rules
│   ├── pricing.ts            adapter onto @indiagate/core's pricing engine
│   └── serviceability.ts     postcode → delivery zone
├── store/                    Zustand: cart, fulfilment
└── types/                    Dish, CartItem, Order, Customer
```

## The decisions worth knowing before you edit anything

**No component computes a total.** All arithmetic goes through
`lib/pricing.ts`, which delegates to `priceCart` in `@indiagate/core` — the
same function the API and the Expo app call. If you are about to write
`items.reduce(...)` in a view, that is the bug.

**Money is an integer number of cents.** No floats, and no field named `price`
without a `Cents` suffix.

**GST is extracted, not added.** Menu prices are quoted inclusive, as they are
across Singapore. Adding 9% on top would overcharge every guest.

**The server reprices everything.** `/api/checkout` takes dish ids, option ids
and quantities — never a price. It resolves the real cost from the catalog,
re-validates every modifier against the dish's current groups, and refuses the
order if the client's `expectedTotalCents` disagrees. Verified: a request
claiming a S$1.00 total for a S$9.30 order comes back `409
checkout/price-changed` with the corrected figures.

**Orders start unpaid.** Only the payment webhook promotes an order to
`PLACED`, so an abandoned 3-D Secure challenge never puts a ticket on the pass.

**The cart snapshots the dish.** Lines carry the name, price and dietary
marking as they were when added, so a persisted cart cannot silently mutate
when the kitchen edits the menu overnight. Line identity is derived from the
*configuration*, so the same dosa at Medium merges into one line and the same
dosa at Mild stays separate.

**Persisted state waits for hydration.** Anything reading localStorage renders
a neutral state until `useHydrated()` returns true. Skipping this gives a
badge that says "3" on the client and nothing on the server, which React
treats as a mismatch and discards.

## Swapping the two seams

**Menu source.** Set `MENU_API_URL` and `NEXT_PUBLIC_OUTLET_ID` and
`getMenuRepository()` returns the API-backed implementation instead of the
bundled catalog. No component changes — see `lib/catalog/repository.ts`.

**Payment gateway.** `PAYMENT_PROVIDER=razorpay` switches adapters. Both
implement `PaymentProvider`, and the UI branches on the envelope's `action`
(`CONFIRM_ON_CLIENT` / `REDIRECT` / `DISPLAY_QR` / `NONE`) rather than on the
provider name.

**Order storage.** `lib/orders/store.ts` keeps orders in a module-level Map.
That is enough to run the flow without a database and is explicitly not
production storage — it is per-process. Replace `InMemoryOrderStore` with a
call to `POST /orders` on the platform API; nothing upstream changes.

## Typography

`--font-sans` and `--font-display` in `globals.css` resolve to platform faces
rather than a downloaded webfont: the build is hermetic, there is no
third-party request, and there is no font-swap layout shift. Each stack names
its ideal face first, so a machine with Cormorant Garamond installed gets it.

To use a real webfont, add a `next/font` loader in `app/layout.tsx` and set
those two variables from its `.variable` output. Nothing else in the design
names a font family.

## Testing card payment locally

```bash
# 1. Put your test keys in apps/web/.env.local
# 2. Forward webhooks and paste the printed secret into STRIPE_WEBHOOK_SECRET
stripe listen --forward-to localhost:3000/api/webhooks/payments
```

Card `4242 4242 4242 4242` succeeds; `4000 0027 6000 3184` forces a 3-D Secure
challenge, which is the path worth exercising — it is where the
webhook-versus-client-callback distinction above actually matters.

## Promo codes in the bundled data

| Code | Effect |
|---|---|
| `GATE15` | 15% off, capped at S$8, minimum S$30 |
| `FREEDEL` | Free delivery, minimum S$35 |
| `DUM10` | S$10 off S$60+ of biryani |
| `PICKUP5` | S$5 off self-pickup over S$25 |

## Commands

```bash
pnpm --filter @indiagate/web dev
pnpm --filter @indiagate/web build      # verified: 9 routes, 148 kB first load on /menu
pnpm --filter @indiagate/web test       # 23 tests — pricing, coupons, serviceability
pnpm --filter @indiagate/web typecheck  # strict, with noUncheckedIndexedAccess
```
