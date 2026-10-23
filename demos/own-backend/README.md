# Own Backend Demo

A React + Bun + SQLite app that manages its own product database, then connects it to shopG41 as a data source.

## What this demonstrates

1. You have your own app with its own SQLite database (this demo)
2. You connect it to shopG41 as a `sqlite` data source
3. You create a pipeline endpoint that queries it with SQL
4. You fetch your data through shopG41 using the `@shopg41/sdk`
5. Your data stays in your SQLite file — shopG41 queries it on demand

## Run the demo

```bash
cd demos/own-backend
bun install
bun run dev
```

Open http://localhost:3002 — add some products via the form.

## Connect to shopG41

> **Must use Bun** — `bun:sqlite` is Bun-only. `node wire.ts` will fail.

Once your shopG41 dev server is running and you have an API key:

```bash
SHOPG41_BASE_URL="http://localhost:3001" \
SHOPG41_API_KEY="sk_..." \
  bun wire.ts
```

This script:
1. Creates a `sqlite` data source pointing at `products.db`
2. Creates a pipeline endpoint `GET /api/e/own-products` with a `query` step
3. Fetches the products via the SDK to verify

## Fetch from your own frontend

```ts
import { ShopG41Client } from "@shopg41/sdk"

const client = new ShopG41Client({
  baseUrl: "https://mystore.shopg41.com",  // or localhost:3001
  apiKey: "sk_..."
})

// Fetch products from YOUR SQLite DB through shopG41's pipeline
const products = await client.endpoints.call("/own-products")
// → { rows: [{ id: 1, name: "T-Shirt", price: 19.99, image_url: "..." }], rowCount: 1 }
```

## Architecture

```
   Your App (localhost:3002)
   ├── React frontend → form to add products
   └── Bun SQLite → products.db
          │
          │ (shopG41 connects to product.db via sqlite data source)
          ▼
   shopG41 (localhost:3001)
   ├── Data source "My Product DB" (kind: sqlite, path: products.db)
   └── Pipeline endpoint /api/e/own-products
         └── Step: query → SELECT * FROM products
                │
                ▼
   Your frontend → SDK → client.endpoints.call("/own-products")
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — serves React frontend + SQLite API |
| `frontend.tsx` | React app — product form + list |
| `index.html` | Entry point with styles |
| `wire.ts` | Script to connect this SQLite DB to shopG41 |
