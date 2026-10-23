# Own Stack Demo

Your own frontend, your own backend, your own Postgres — with shopG41 beside it
rather than underneath it. Everything in this folder runs on your machine and
talks to a shopG41 dev server on `:3001`.

```
  your frontend  http://localhost:3009
        │
        ▼
  your backend   demos/own-stack/index.ts   (Bun.serve, port 3009)
        │
        ▼
  your database  postgresql://localhost:5432/ownstack   ← not the platform's DB
        ▲
        │  proxied catalogue calls, HMAC-signed
        │
  shopG41        http://localhost:3001   (store: demo.localhost:3001)
        ▲
        │
  shoppers       the platform's storefront, now served by *your* backend
```

## Why this demo exists

shopG41 has two supported ways to bring your own stack, and they point in
opposite directions:

| | Feature | Who calls whom |
|---|---|---|
| **Pull** | data sources + `/api/e/…` endpoints | shopG41 calls *you* (or your database) — see [`../own-backend`](../own-backend) |
| **Push** | **external backend** (this demo) | shopG41 forwards *shoppers* to you on the catalogue routes |

`../own-backend` demonstrates the pull direction with SQLite. This demo does the
push direction with Postgres, which is the version that survives contact with a
real deployment: SQLite data sources open a file on the **platform's** disk, so
they only work when the database and the platform share a machine.

## Run it

Four terminals, or three if the platform is already up.

```bash
# 1. the platform
cd shopG41 && bun run dev                      # http://localhost:3001
cd shopG41 && bun run seed-demo                # a seeded `demo` store

# 2. your backend (creates its own database on first boot)
cd demos/own-stack && bun install && bun run dev   # http://localhost:3009

# 3. an API key for the demo store, then wire it up
cd demos/own-stack && bun run mint-key
cd demos/own-stack && bun run wire             # add --allow-loopback locally
```

Open <http://localhost:3009> and you get three panels: your database, your
backend's proxy log (one row per call shopG41 made into it), and a button that
asks the platform for its catalogue and compares it with yours.

`wire` also wires the **opposite** direction, because the two are easy to
confuse: it registers `postgres://…/ownstack` as a data source and publishes
`GET /api/e/own-stack-products`, a pipeline endpoint whose `query` step runs
`select … from catalogue` against your database. One database, both directions.

Then look at the platform itself:

```bash
curl -H "X-Tenant: demo" http://localhost:3001/api/products
curl -H "X-Tenant: demo" http://localhost:3001/api/banners
curl -H "X-Tenant: demo" http://localhost:3001/api/e/own-stack-products
```

All three are answered by the backend and database in this folder. Poke a route
that must stay on the platform and nothing happens here:

```bash
curl -H "X-Tenant: demo" http://localhost:3001/api/site/settings   # platform
```

Undo everything with `bun run wire --undo` (it disables the external backend and
deletes the data sources and the endpoint it created).

## The scripts

| File | What it is |
|---|---|
| `index.ts` | Your backend: `Bun.serve` over your Postgres, with the platform-shaped catalogue routes and HMAC verification |
| `frontend.tsx` | Your frontend (React): reads and writes your database, shows the proxy log |
| `mint-key.ts` | Dev-only: mints an `admin`-scope key for the demo store into `.env.local` |
| `wire.ts` | Registers the backend as a `passthrough` data source, enables the external backend, and proves the result |
| `platform.ts` | Dev-only bridge to the platform's env + database, used by the two scripts above |

Environment (all optional, sensible defaults):

| Variable | Default | Meaning |
|---|---|---|
| `OWNSTACK_DATABASE_URL` | `postgresql://localhost:5432/ownstack` | your database; created on first boot |
| `OWNSTACK_PORT` | `3009` | your backend |
| `OWNSTACK_HMAC_SECRET` | `own-stack-demo-secret` | the shared secret for `X-ShopG41-Signature` |
| `OWNSTACK_PUBLIC_URL` | `http://127.0.0.1:3009` | the URL the platform should call; must be public unless `--allow-loopback` |
| `SHOPG41_BASE_URL` | `http://localhost:3001` | the platform |
| `SHOPG41_TENANT_HOST` | `demo.localhost:3001` | the store whose catalogue is replaced |
| `SHOPG41_TENANT_ID` | _(from the host)_ | use a specific store instead |
| `SHOPG41_API_KEY` | `.env.local` | written by `mint-key` |

## The one wrinkle: loopback

The platform refuses to call a private address, so registering
`http://127.0.0.1:3009` fails with:

```
Private/loopback IP addresses are not allowed
```

That is the SSRF guard doing its job: the data source URL is tenant-supplied and
the platform fetches it, so it must not be pointable at internal infrastructure.
You have two options.

**The production-shaped way** — give your backend a public HTTPS URL and
register that:

```bash
OWNSTACK_PUBLIC_URL=https://your-tunnel.example bun run wire
```

**The local way** — `bun run wire --allow-loopback` writes the data source
straight into the platform's database, using the platform's own config
encryption, instead of going through the API that would have rejected it. The
script prints what it bypassed. Two consequences worth knowing:

- the URL is stored unvalidated; the runtime proxy does not re-check it, so a
  hostname that resolved publicly at registration time and privately later is
  not caught (the general DNS-rebinding caveat);
- the running platform does not know the tenant row changed, so the script reads
  the store back through the tenant **id** (a resolution key nothing has used
  yet) rather than waiting out the 60s tenant cache.

## What the platform asks of your backend

`GET /api/products`, `GET /api/products/:id`, `GET /api/banners`,
`GET /api/admin/products`, `GET /api/admin/images`,
`GET /api/admin/product-types`, `GET /api/admin/banners/:imageId`, and
`POST /api/admin/items`. Requests arrive with:

| Header | Meaning |
|---|---|
| `Content-Type` | the caller's own content type, unchanged |
| `X-ShopG41-Tenant` | the tenant id |
| `X-ShopG41-Signature` | HMAC-SHA256 of the raw body with the shared secret |

Cookies and `Authorization` are never forwarded — that is the platform's
no-PII guarantee, and it is why the signature is the only thing worth trusting.
Because your backend cannot see who is calling, the platform keeps authorizing
its own admin routes before handing them over: an anonymous `POST
/api/admin/items` is a `401` from shopG41 and never reaches this code, while a
request from the owner or an `admin`-scope key does (and still arrives with no
credentials attached). `index.ts` verifies the signature on every write and
answers `401` otherwise; you can see that for yourself:

```bash
curl -i http://127.0.0.1:3009/api/products          # 401 Invalid signature
```

Orders, checkout, customers, settings, reviews, blog, CMS, API keys and webhooks
all stay on the platform and are never proxied here.

`POST /api/admin/items` arrives as JSON or as the admin UI's `multipart/form-data`
(the body is forwarded byte-for-byte). This demo accepts the JSON form and
answers `415` to multipart, since storing an uploaded image is your backend's
job and out of scope for a demo.

Full reference: [shopG41 docs — external backend](https://shopg41.com/docs/developers/external-backend).

## Caveats this demo makes visible

- **One request, one pooled connection.** The platform runs the whole request —
  including the upstream call — inside a tenant-scoped transaction, and holds one
  pooled connection for its lifetime (max 10 in the platform's tenant pool). A slow
  backend therefore occupies a connection for up to the 10s timeout. Fine for a
  demo; measure it before you rely on it.
- **Tenant resolution is cached for 60s** in-process, keyed by the host or the
  `x-tenant` value. The API invalidates it; a direct database write does not.
- **`mint-key.ts` is a development shortcut.** It writes the same row the admin
  API would (`sk_` + 32 hex, SHA-256 hashed, `admin` scope) because a local demo
  should not need a browser session. In production use **Admin → API & Webhooks**.
- **The admin page exists too.** **Admin → External Backend**
  (`/admin/external-backend`) is the same two steps with a URL form and a state
  card, and it lists the routes that move. `wire.ts` still exists for this demo
  because a loopback URL cannot pass the guard through the API, so the script is
  the only way to bind one.
