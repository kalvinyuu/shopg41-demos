# shopG41 Demos

Seven self-contained, runnable examples of building on the shopG41 platform.
Each folder is its own Bun + React app with a `wire.ts` script that registers the
shopG41 resources it needs — data sources, pipeline endpoints, webhooks, API keys,
CMS collections — so you can see the whole loop instead of reading about it.

All seven run against a shopG41 store: your local dev server
(`http://localhost:3001`) or a real one such as
`https://uniqueboutique-demo.shopg41.com`.

## Prerequisites

1. **A shopG41 instance** — local: `bun --cwd shopG41 run dev` (port 3001), or any
   hosted store.
2. **A seeded tenant** — local: `bun --cwd shopG41 run seed-demo` creates the
   `demo` and `uniqueboutique-demo` stores.
3. **An API key with `admin` scope** — create one in **Admin → API & Webhooks**.
4. **R2 configured** on the instance (only the storage demo needs this).

Tenant resolution: `SHOPG41_BASE_URL` defaults to `http://demo.localhost:3001`, so
the platform resolves a tenant from the `demo` subdomain. If you use plain
`http://localhost:3001`, set `SHOPG41_TENANT="<subdomain-or-id>"` and the demo
sends an `X-Tenant` header instead. Against a hosted store, point
`SHOPG41_BASE_URL` at its URL.

## Demos

| Demo | Port | What it shows |
|------|------|---------------|
| [`own-backend`](demos/own-backend) | 3002 | Your own SQLite product DB, exposed to shopG41 as a `sqlite` data source + `query` pipeline step |
| [`webhooks`](demos/webhooks) | 3004 | HMAC-signed webhook deliveries, delivery log, replay and retry |
| [`storage-functions`](demos/storage-functions) | 3005 | Upload to R2 storage + call a serverless function via an HMAC-signed pipeline step |
| [`ai`](demos/ai) | 3006 | A `query` → `ai` → `transform` pipeline: SQLite products plus an OpenAI-compatible LLM writing the copy |
| [`headless-store`](demos/headless-store) | 3007 | SDK-only storefront: products → cart → Stripe checkout → orders, with live `order.placed`/`order.paid` webhooks |
| [`multi-tenant`](demos/multi-tenant) | 3008 | One instance, two isolated subdomain tenants — products, CMS, keys, cross-tenant checks |
| [`own-stack`](demos/own-stack) | 3009 | Your own frontend + backend + **Postgres**, serving the store's catalogue through the external-backend proxy |

The last two point in opposite directions and are worth reading together:
`own-backend` has shopG41 call *your* database (a `query` step at `/api/e/…`),
while `own-stack` has shopG41 forward *shoppers* to your backend (the external
backend). `own-stack` is the Postgres version, and it is the one that works when
your database is not on the platform's machine.

### Same machine vs hosted platform

`own-backend` and `ai` hold their data in SQLite, and the mechanism changes with
where the platform runs:

| Platform | How it reads the rows |
|----------|-----------------------|
| On this machine (local dev, self-hosted) | a `sqlite` data source — the platform opens the file |
| Hosted (prod) | a signed HTTPS `function` step — the platform calls your app |

SQLite has no network protocol, so the file must be on the platform's disk for
the `sqlite` kind. Both `wire.ts` scripts support both: `--local` for the first,
`BACKEND_URL` (a tunnel) for the second. The signed route runs on its own port
(`3012`, `3013`) so the tunnel never exposes the write form.

One runtime note: the `sqlite` data source only works when the platform runs on
**Bun**. `bun run dev` (Vite) runs the server under Node, where `bun:sqlite` does
not exist — the connection test returns a 500 there. Use the Bun entry
(`server.ts`) or the deployed binary for `--local`; the HTTPS shape works under
either.

## Quick start

```bash
bun install                 # once, at the repo root (Bun workspaces)
cd demos/<name>
bun run dev                 # start the demo app on its port
SHOPG41_API_KEY="sk_..." bun run wire   # wire it to shopG41
```

Then open the demo's port and interact with the UI. `bun run wire` is idempotent
enough to re-run; each demo's README documents exactly what it creates.

## The SDK

The demos use the typed client, and this repo vendors its source in
[`packages/sdk`](packages/sdk) — no npm install, no build step. It is the same
zero-dependency client published as `@shopg41/sdk`; see
[`packages/sdk/README.md`](packages/sdk/README.md) for the full reference.

```ts
import { ShopG41Client } from "@shopg41/sdk"

const client = new ShopG41Client({ baseUrl: "https://your-store.shopg41.com" })
const { products } = await client.products.list()
```

Docs: <https://shopg41.com/docs> · API reference: `GET /api/docs` and
`GET /api/openapi.json` on any shopG41 instance.

## Notes

- Every demo is a **Bun** app (`bun:sqlite`, `Bun.serve`, `bun --hot`). `node` will
  not run them.
- Demos that need to *receive* calls from the platform (`webhooks`,
  `storage-functions`, `own-backend`, `ai`, `own-stack`) need a URL the platform
  can reach. For local dev that means a tunnel (or, for `own-stack`, its
  documented `--allow-loopback` shortcut); a hosted shopG41 cannot reach
  `localhost`.
- No credentials are committed. `.env*`, `*.db` and `keys.json` are gitignored;
  each demo writes what it needs on first run.

## License

[MIT](LICENSE) © shopG41.
