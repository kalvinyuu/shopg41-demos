# @shopg41/sdk

Typed JavaScript/TypeScript SDK for the shopG41 store platform. Works in browsers, Node.js, Bun, Cloudflare Workers — anywhere with `fetch`.

## Install

```bash
bun add @shopg41/sdk
# or
npm install @shopg41/sdk
```

## Quick start

```ts
import { ShopG41Client } from "@shopg41/sdk"

const client = new ShopG41Client({
  baseUrl: "https://mystore.shopg41.com",
  apiKey: "sk_...", // optional — needed for admin operations
})
```

## Public API

All methods are fully typed. Authentication is automatic — cookie-based for browser requests, API key header for programmatic access.

### Products

```ts
const { products } = await client.products.list()
const { product } = await client.products.get(1)
const { images } = await client.products.gallery(1)
const { options, customFields, variants } = await client.products.options(1)
```

Every product carries `kind` (`physical` | `digital` | `service` | `food` |
`subscription` | `booking`) and the matching `fulfilment` settings, so a headless
storefront can render the right buy button and the right questions.

### Blog

```ts
const { posts } = await client.blog.list()
const { post } = await client.blog.get("my-post-slug")
```

### CMS

```ts
const { entries } = await client.cms.list("testimonials")
const { entry } = await client.cms.get("testimonials", 1)
```

### Storefront

```ts
const { settings } = await client.storefront.settings()
const { analytics } = await client.storefront.analytics()
const { banners } = await client.storefront.banners()
```

### Orders (requires auth)

```ts
const { orders } = await client.orders.list()
```

### Cart and checkout

There is no server-side cart: a basket lives in your app, and the endpoint
validates it when you check out. **No API key is needed** — checkout is a public
route, and a guest is a normal customer.

```ts
const { url } = await client.checkout.createSession({
  items: [{ productId: 1, quantity: 2 }],
})
// redirect to `url` for Stripe checkout
```

`createSession` accepts either that ergonomic form or the wire form the endpoint
actually takes (`CartDetails`, the map keyed by product id declared in
`src/types.ts`). The items form is resolved first: the store's
public catalogue supplies each line's Stripe `price_id` (which is what the
server matches its inventory on), and a line that chose options has their price
adjustments read from `GET /api/products/:id/options` — never from your request
body. That costs up to three public requests before checkout: products,
settings, and the options of any product whose options were chosen.

The server enforces the basket on its side regardless: stock, a £0.30 minimum,
20 items maximum, one subscription per session, and the store's tax and delivery
settings. Orders are created by the Stripe webhook, not by this call.

### Custom endpoints

```ts
// Tenants can define custom endpoints at /api/e/*
const data = await client.endpoints.call<MyType>("/featured-products")
const result = await client.endpoints.call("/submit", {
  method: "POST",
  body: { name: "value" },
})
```

## Admin API

Only available when `apiKey` is set:

```ts
const admin = new ShopG41Client({
  baseUrl: "https://mystore.shopg41.com",
  apiKey: "sk_a1b2c3d4e5f6a7b8",
}).admin
```

### Products

```ts
// List all (with images, options, variants)
const { products } = await admin.products.list()

// Create (multipart form data required for images)
const { success } = await admin.products.create({
  name: "T-Shirt",
  price: 29.99,
  shopBy: "each",
  image: file, // File | Blob
  imageName: "shirt.jpg",
  typeId: 5, // optional
})

// Sell something that is not a box. `kind` decides how the order is fulfilled:
// a download is emailed a signed link, a service collects a brief, food gets a
// delivery window, a subscription bills on an interval, a session books a slot.
await admin.products.create({
  name: "Store setup",
  price: 120,
  shopBy: "each",
  image: file,
  imageName: "setup.jpg",
  kind: "booking",
  fulfilment: { bookingUrl: "https://cal.com/you/setup", durationMinutes: 60 },
})

await admin.products.create({
  name: "Starter template",
  price: 49,
  shopBy: "each",
  image: file,
  imageName: "template.jpg",
  kind: "digital",
  fulfilment: { assetUrl: "https://cdn.example.com/template.zip", maxDownloads: 5 },
})

await admin.products.create({
  name: "Lunch plan",
  price: 30,
  shopBy: "each",
  image: file,
  imageName: "lunch.jpg",
  kind: "subscription",
  fulfilment: { interval: "week", intervalCount: 1, subscriptionFulfilment: "delivery" },
})

// Update
await admin.products.update(1, {
  name: "Updated",
  price: 34.99,
  shopBy: "each",
  cardTemplateId: 3,
})

// Delete (soft if orders exist, hard otherwise)
await admin.products.delete(1)

// Manage options and variants
const opts = await admin.products.options(1)
await admin.products.updateOptions(1, {
  options: [{ name: "Size", values: [{ value: "S" }, { value: "M" }] }],
  customFields: [],
})

const vars = await admin.products.variants(1)
await admin.products.updateVariants(1, {
  variants: [{ sku: "TSH-SM", price: 29.99, stock: 50 }],
})
```

### Orders

```ts
const { orders } = await admin.orders.list()
const { order } = await admin.orders.get(1)
await admin.orders.updateStatus(1, "shipped")
```

### Banners

```ts
const { banners } = await admin.banners.list() // active banners
const { images } = await admin.banners.images() // all images with products
const banner = await admin.banners.get(42)
await admin.banners.update(42, { bannerName: "Sale", isActive: true })
await admin.banners.delete(42)
```

### Settings

```ts
const { settings } = await admin.settings.get()
await admin.settings.update({
  general: { storeName: "Acme", tagline: "..." },
  commerce: { currency: "usd", taxEnabled: true },
})
```

### Product types

```ts
const { productTypes } = await admin.productTypes.list()
const { productType } = await admin.productTypes.create({ name: "Apparel" })
await admin.productTypes.update(1, { name: "Updated", options: [...] })
await admin.productTypes.applyToProduct(1, 5) // apply type 1 to product 5
await admin.productTypes.delete(1)
```

### Data sources

```ts
const { dataSources } = await admin.dataSources.list()
const { success, id } = await admin.dataSources.create({
  name: "External API",
  kind: "passthrough",
  config: { url: "https://my-api.com/hook", secret: "hmac-secret" },
})

// SQLite database
await admin.dataSources.create({
  name: "My SQLite DB",
  kind: "sqlite",
  config: { path: "/var/data/my-store.db" },
})

// External Postgres
await admin.dataSources.create({
  name: "Analytics DB",
  kind: "postgres",
  config: { connectionString: "postgresql://..." },
})

await admin.dataSources.update(1, { enabled: false })
const result = await admin.dataSources.test(1) // { ok: true }
await admin.dataSources.delete(1)
```

### CMS

```ts
// Collections
const { collections } = await admin.cms.collections.list()
const { collection } = await admin.cms.collections.get(1)
const { success, id } = await admin.cms.collections.create({
  name: "FAQ",
  slug: "faq", // auto-generated if omitted
  fields: [
    { key: "question", label: "Question", type: "text" },
    { key: "answer", label: "Answer", type: "textarea" },
  ],
})
await admin.cms.collections.update(1, { status: "published" })
await admin.cms.collections.delete(1)

// Entries
const { entries } = await admin.cms.entries.list(1)
const entry = await admin.cms.entries.get(1, 5)
await admin.cms.entries.create(1, {
  data: { question: "What is this?", answer: "A store." },
  status: "published",
})
await admin.cms.entries.update(1, 5, { data: { question: "Updated?" } })
await admin.cms.entries.delete(1, 5)
```

### Custom endpoints

```ts
const { endpoints } = await admin.endpoints.list()
await admin.endpoints.create({
  name: "Featured Products",
  path: "featured",
  method: "GET",
  handlerKind: "collection", // or "passthrough", "pipeline"
  handlerConfig: { collectionId: 5 },
})
await admin.endpoints.update(1, { enabled: false })
await admin.endpoints.delete(1)
```

### Blog

```ts
const { posts } = await admin.blog.list()
const { post } = await admin.blog.get(1)
await admin.blog.create({ title: "Hello", content: { type: "doc", content: [] } })
await admin.blog.update(1, { status: "published" })

// Agents: write Markdown, convert client-side — no hand-built Tiptap JSON.
import { markdownToTiptapDoc } from "@shopg41/sdk"
await admin.blog.create({
  title: "Hello again",
  content: markdownToTiptapDoc("# Hello\n\nFirst post."),
  status: "published",
})
```

Blog keys work on **any blog-enabled plan** (including Site Free) — see
`shopG41/docs/developers/mcp.md`. Blog-only keys are confined to the blog
surface and cannot take the `admin` scope.

// Upload an image for blog content
const { url } = await admin.blog.uploadImage(file)
await admin.blog.delete(1)

````

### Card templates

```ts
const { templates } = await admin.card.list()
const { template } = await admin.card.create({ name: "Business Card", width: 1050, height: 600 })
await admin.card.update(1, { design: { ... } })
await admin.card.delete(1)
````

### Integrations

```ts
const { integrations } = await admin.integrations.list()
await admin.integrations.connect("posthog", { apiKey: "phc_..." })
await admin.integrations.test("posthog")
await admin.integrations.disconnect("posthog")
```

### Plan

```ts
const { plan, subscription, usage, tenant } = await admin.plan.get()
// plan.limits.productLimit, usage.productCount, subscription.status, etc.
```

### API Keys

```ts
const { keys } = await admin.apiKeys.list()
const { key } = await admin.apiKeys.create({ name: "CI Pipeline" })
// → { success: true, id: 3, key: "sk_a1b2c3d4e5f6a7b8" }
// NOTE: `key` is only returned once at creation. Save it immediately.
await admin.apiKeys.revoke(3)
```

### Me

```ts
const { isAdmin, viaApiKey } = await admin.me.get()
```

### Agent

Grounded store assistant. Reads live store data; any change is staged for
approval (never applied automatically).

```ts
const res = await admin.agent.chat({
  messages: [{ role: "user", content: "what sold best, and ship order #12" }],
})
// res.reply — grounded answer
// res.pendingActions — staged changes to approve via admin.orders.updateStatus / admin.products.update
```

### External backend (headless)

A tenant can point its catalog at its own backend (VPS/serverless) so product
data and stock live there — everything else (orders, users, checkout, reviews,
CMS, blog, settings, API keys) stays on shopG41 and no PII is proxied.

```ts
// Bind a tenant-owned `passthrough` data source as the external backend:
await admin.dataSources.create({
  name: "my-backend",
  kind: "passthrough",
  config: { url: "https://api.example.com", secret: "hmac-secret" },
})

// Then enable it (raw endpoint; no SDK helper yet):
await fetch(`${baseUrl}/api/admin/backend`, {
  method: "PUT",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ enabled: true, dataSourceId: 12 }),
})
```

When enabled, catalog routes proxy to your backend:
`GET /api/products`, `/api/products/:id`, `/api/products/:id/gallery`,
`/api/products/:id/options`, `/api/banners`, and the matching `/api/admin/*`
catalog routes (`products`, `images`, `items`, `product-types`, `banners`).
Proxied requests carry `X-ShopG41-Tenant` and an `X-ShopG41-Signature` HMAC
(SHA-256 of the body, signed with the data source `secret`); cookies and
`Authorization` are never forwarded.

Checkout handoff: your storefront calls `POST /api/checkout/session` with line
items `{ productId, name, quantity, price }`, where `productId` is your own id
(string). shopG41 records the order and emits `order.placed` / `order.paid`
webhooks so you can decrement your own stock.

## Error handling

```ts
import {
  ShopG41Client,
  ShopG41Error,
  ShopG41AuthError,
  ShopG41NotFoundError,
  ShopG41ValidationError,
} from "@shopg41/sdk"

try {
  await client.products.get(99999)
} catch (e) {
  if (e instanceof ShopG41NotFoundError) {
    console.log("Product not found")
  } else if (e instanceof ShopG41AuthError) {
    console.log("Invalid or expired API key")
  } else if (e instanceof ShopG41Error) {
    console.log(`API error ${e.status}: ${e.message}`, e.body)
  }
}
```

## API Keys

API keys authenticate as a tenant admin for programmatic access. They are created via the admin API or admin panel.

### Key format

```
sk_<16 random hex chars>
```

Example: `sk_a1b2c3d4e5f6a7b8`

### How it works

1. **Creation** — `POST /api/admin/api-keys` generates a key. The full key is returned once. A SHA-256 hash is stored server-side.
2. **Auth** — Send `Authorization: Bearer sk_...` with requests. The server hashes the incoming key and compares it to the stored hash.
3. **Rate limiting** — Each key has limits (default: 300 req/min, 10,000 req/day). Exceeded limits return 429 with `X-RateLimit-*` headers.
4. **Revocation** — Keys can be revoked at any time. Revoked keys immediately stop working.

### Security

- Keys are one-way hashed — they can never be retrieved after creation
- Keys are tenant-scoped — they only work for the tenant they were created for
- Keys can be revoked from the admin panel or API
- Store keys like passwords — in environment variables, never in code

### Public rate limiting

Unauthenticated requests to `/api/*` are rate-limited at 100 req/min per IP address.

## Pipeline endpoints

Pipelines let you chain multiple handlers together in sequence. Each step's output becomes the input to the next step. No arbitrary code execution — only `collection`, `passthrough`, `query`, and `function` handlers.

### Configuration

```json
{
  "steps": [
    { "type": "collection", "collectionId": 5 },
    { "type": "function", "dataSourceId": 3 },
    { "type": "passthrough", "dataSourceId": 2 }
  ]
}
```

### Step types

| Type          | What it does                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `collection`  | Fetches published entries from a CMS collection                                                                                                                   |
| `passthrough` | POSTs the previous step's output (`{ prev: ... }`) to an external API via a data source                                                                           |
| `function`    | Calls a tenant-owned serverless function (CF Worker, Lambda, Vercel) via a data source. Same contract as passthrough — receives `{ prev }`, returns `{ result }`. |
| `query`       | Runs a SQL query against a connected Postgres or SQLite data source                                                                                               |

### Query steps

Query steps run SQL directly against a data source of kind `postgres` or `sqlite`. They accept parameters and optional limits.

```json
{
  "steps": [
    {
      "type": "query",
      "dataSourceId": 2,
      "sql": "SELECT sku, name, price FROM products WHERE category = $1",
      "params": ["electronics"],
      "timeout": 5000,
      "maxRows": 100
    }
  ]
}
```

**Safety limits** (applied automatically, can be overridden per step):

| Limit     | Default | Description                                                                       |
| --------- | ------- | --------------------------------------------------------------------------------- |
| `timeout` | 5000ms  | Connection + query timeout                                                        |
| `maxRows` | 1000    | `LIMIT` appended to all queries. Prevents full table scans from hogging your VPS. |

**Supported data source kinds for queries:**

| Kind          | Read/Write | Notes                                                          |
| ------------- | ---------- | -------------------------------------------------------------- |
| `postgres`    | Full R/W   | Uses their connection string. They already have `psql` access. |
| `sqlite`      | Full R/W   | Opens their file. They already have `sqlite3` CLI access.      |
| `redis`       | Not yet    | `query()` not implemented                                      |
| `passthrough` | N/A        | HTTP proxy only, use the `passthrough` step type instead       |

### Full pipeline example: CMS data enriched from SQLite

```ts
// 1. Create a SQLite data source
await admin.dataSources.create({
  name: "Inventory DB",
  kind: "sqlite",
  config: { path: "/var/data/inventory.db" },
})

// 2. Create a CMS collection for product listings
await admin.cms.collections.create({
  name: "Products",
  slug: "products",
  fields: [{ key: "title", label: "Title", type: "text" }],
})

// 3. Create the pipeline: CMS entries → enrich with SQLite data → forward to external API
await admin.endpoints.create({
  name: "Enriched Products",
  path: "enriched-products",
  method: "GET",
  handlerKind: "pipeline",
  handlerConfig: {
    steps: [
      { type: "collection", collectionId: 5 },
      {
        type: "query",
        dataSourceId: 1,
        sql: "SELECT * FROM inventory WHERE product_id = $1",
        params: ["{{prev.id}}"],
      },
      { type: "passthrough", dataSourceId: 2 },
    ],
  },
})

// 4. Call it
const data = await client.endpoints.call("/enriched-products")
```

### Function steps

Function steps call tenant-owned serverless functions (CF Workers, Vercel, AWS Lambda, etc.). The function receives `{ prev: <previous-step-output> }` and should return `{ result: ... }`. No code runs on shopG41 servers — your function is deployed wherever you want.

```ts
// 1. Create a function data source
await admin.dataSources.create({
  name: "Price Converter",
  kind: "function",
  config: { url: "https://my-worker.workers.dev", secret: "shared-secret" },
})

// 2. Create a pipeline that fetches CMS data, then transforms it via your function
await admin.endpoints.create({
  name: "Converted Prices",
  path: "converted-prices",
  method: "GET",
  handlerKind: "pipeline",
  handlerConfig: {
    steps: [
      { type: "collection", collectionId: 5 },
      { type: "function", dataSourceId: 1 },
    ],
  },
})
```

**Function contract:**

```json
// Request (what you receive)
{ "prev": { "collection": "products", "entries": [...] } }

// Response (what you must return)
{ "result": { ... } }
```

### Pure query pipeline (no CMS)

```ts
await admin.endpoints.create({
  name: "Top Products",
  path: "top-products",
  method: "GET",
  handlerKind: "pipeline",
  handlerConfig: {
    steps: [
      {
        type: "query",
        dataSourceId: 2,
        sql: "SELECT name, price, category FROM products ORDER BY sales_count DESC",
        maxRows: 20,
      },
    ],
  },
})
```

### Limits

- Max 5 steps per pipeline
- Each passthrough step times out after 10 seconds
- Query steps time out after 5 seconds by default
- Query steps are capped at 1000 rows by default
- Invalid configs or missing data sources return descriptive errors with step numbers

## Configuring fetch

For environments without global `fetch` (or to add logging, retries, etc.):

```ts
const client = new ShopG41Client({
  baseUrl: "https://mystore.shopg41.com",
  apiKey: "sk_...",
  fetch: myCustomFetch, // must match the native fetch API
})
```
