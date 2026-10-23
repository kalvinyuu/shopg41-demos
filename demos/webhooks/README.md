# Webhooks Demo

Shows shopG41's real-time webhooks: this app is the **receiver**. shopG41
delivers signed, idempotent events to it the moment they happen, and this
demo verifies each signature and lets you replay/retry from the delivery log.

## What this demonstrates

1. Subscribe a URL to platform events (`order.placed`, `entry.published`, …)
2. shopG41 fans events out to your URL — HMAC-SHA256 signed
   (`X-ShopG41-Signature`), idempotent (`X-ShopG41-Event-ID`)
3. This receiver verifies the signature and shows the live feed
4. Delivery log, replay, and retry are all one admin call away

```
   shopG41 (localhost:3001)
   ├── webhook subscription → http://localhost:3004/webhook
   ├── CMS collection "announcements"
   └── publish an entry → emit("entry.published")
         │  POST /webhook (signed with X-ShopG41-Signature)
         ▼
   This app (localhost:3004) — verifies HMAC, shows the delivery
```

## Run the demo

```bash
cd demos/webhooks
bun install
bun run dev        # http://localhost:3004
```

## Connect to shopG41

While shopG41 runs on `:3001` with an **admin-scoped** API key
(webhooks are admin-only):

```bash
SHOPG41_BASE_URL="http://demo.localhost:3001" \
SHOPG41_API_KEY="sk_..." \
  bun run wire
```

The script:
1. Creates a CMS collection
2. Creates a webhook subscription pointing at `http://localhost:3004/webhook`
3. Publishes an entry — a real `entry.published` event is delivered
4. Prints shopG41's delivery log

Then open http://localhost:3004 — you'll see the verified delivery. Use the
buttons to publish more entries, send a synthetic `order.placed`, replay the
last delivery, retry failed ones, and inspect shopG41's own delivery log.

> The subscription events include `product.created/updated/deleted` and
> `order.status.changed`, so creating a product or updating an order in the
> shopG41 admin panel also delivers here.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — webhook receiver (HMAC verify) + shopG41 admin calls |
| `frontend.tsx` | React app — live delivery feed + trigger/replay/retry buttons |
| `index.html` | Entry point with styles |
| `wire.ts` | Script to create the collection + subscription and fire an event |
