# Headless Storefront Demo

A storefront built **purely on the `@shopg41/sdk`** — no shopG41 frontend code.
Browse products → cart → Stripe Checkout → order created → `order.placed` /
`order.paid` webhooks fire in real time.

## What this demonstrates

1. **Public SDK**: `client.products.list()`, `client.storefront.settings()`
2. **Checkout**: `POST /api/checkout/session` → Stripe-hosted page (test mode)
3. **Orders**: admin SDK lists the created order with items, totals, status
4. **Webhooks**: the same `order.placed` / `order.paid` events are delivered
   here signed (HMAC) the instant checkout completes

```
   Headless frontend (localhost:3007)
   ├── SDK public → products, settings
   ├── SDK admin  → orders
   └── POST /webhook ← order.placed / order.paid (signed)
          │
          ▼
   shopG41 (localhost:3001)
   ├── /api/products, /api/site/settings
   ├── /api/checkout/session → Stripe Checkout (test card 4242 4242 4242 4242)
   ├── /api/stripe/webhook  ← checkout.session.completed
   ├── /api/admin/orders
   └── webhook subscription → localhost:3007/webhook
```

## Run the demo

```bash
cd demos/headless-store
bun install
bun run dev        # http://localhost:3007
```

## Connect to shopG41

While shopG41 runs on `:3001` with an **admin-scoped** API key:

```bash
SHOPG41_BASE_URL="http://demo.localhost:3001" \
SHOPG41_API_KEY="sk_..." \
  bun run wire
```

This seeds 4 products (with generated images) and subscribes an
`order.placed`/`order.paid` webhook pointing at this demo.

## Complete a checkout

The tricky part is the Stripe completion webhook reaching localhost. Forward it:

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
```

Copy the printed `whsec_...` into `shopG41/.env.local` as `STRIPE_WEBHOOK_SECRET`
(and `STRIPE_TEST_WEBHOOK_SECRET` if in test mode), restart shopG41, then:

1. Add products to the cart → **Checkout with Stripe**
2. Pay with the test card `4242 4242 4242 4242`, any future expiry, any CVC
3. Back in the demo, **Refresh orders** — the order is there
4. The signed `order.placed` / `order.paid` deliveries appear live in the panel

> Without the webhook forward, checkout still works but shopG41 never creates
> the order, so orders and the delivery feed stay empty.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — SDK calls + order webhook receiver |
| `frontend.tsx` | React app — product grid, cart, checkout, orders, deliveries |
| `index.html` | Entry point with styles |
| `wire.ts` | Script to seed products + subscribe the order webhooks |
