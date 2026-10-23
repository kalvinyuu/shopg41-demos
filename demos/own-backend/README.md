# Own Backend Demo

A React + Bun + SQLite app that owns its product database, and lets shopG41 read
it — without moving the data anywhere.

## Two shapes, because "your own database" depends on where the platform runs

| Shape | How shopG41 reads it | Use when |
|-------|----------------------|----------|
| **`sqlite` data source** | The platform opens `products.db` itself | The platform runs on the same machine (local dev, self-hosted) |
| **HTTPS `function` step** | The platform calls this app's signed `/function` route | The platform is hosted elsewhere (prod) — the file stays with you |

SQLite has no network protocol, so the first shape can never cross machines: the
platform is the client, and it opens a file path. The second shape gives the
platform an HTTP surface instead, which is what "my backend, my data" looks like
when the platform is not on your laptop.

```
   your machine                                  shopG41 (hosted)
   ┌──────────────────────────────┐             ┌────────────────────────────┐
   │ UI :3002  ──writes──►        │             │ passthrough data source     │
   │   products.db                │             │   → https://tunnel/function │
   │ /function :3012 ◄────────────┼── HTTPS ────│ pipeline GET /api/e/…       │
   └──────────────────────────────┘   HMAC      └────────────────────────────┘
```

## What this demonstrates

1. You have your own app with its own SQLite database (this demo)
2. You expose it to shopG41 — as a `sqlite` data source, or as a signed function
3. You fetch your data through shopG41 using the `@shopg41/sdk`
4. Your data stays in your SQLite file — shopG41 reads it on demand
5. Writes never leave your app: add a product here and the next platform call
   returns it

## Run the demo

```bash
cd demos/own-backend
bun install
bun run dev
```

- <http://localhost:3002> — the app (add products)
- <http://localhost:3012/function> — the signed route shopG41 calls

The signed route is on its own port on purpose: a tunnel should expose
`/function` without exposing the write form.

## Connect it

### Platform on this machine

```bash
SHOPG41_BASE_URL="http://localhost:3001" \
SHOPG41_API_KEY="sk_..." \
  bun run wire --local
```

Registers a `sqlite` data source at an **absolute** path. A relative path would
resolve against the platform's working directory, not this demo's — which is the
bug this script used to have.

### Platform hosted elsewhere

```bash
# 1. expose only the signed route
cloudflared tunnel --url http://localhost:3012
#    → https://<something>.trycloudflare.com

# 2. wire it
BACKEND_URL="https://<something>.trycloudflare.com" \
SHOPG41_BASE_URL="https://your-store.shopg41.com" \
SHOPG41_API_KEY="sk_..." \
  bun run wire
```

That creates one `passthrough` data source pointing at `/function` and publishes
`GET /api/e/own-products` as `function → transform`. Nothing but a URL and a
secret hash is stored on the platform.

```bash
bun run wire --undo   # remove the data source and endpoint
```

> The tunnel is the demo. Stop it and `/api/e/own-products` fails until it is
> back — the platform is genuinely calling your machine.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_URL` | — | Public URL of this app (required for the remote shape) |
| `FUNCTION_SECRET` | `own-backend-demo-secret` | HMAC key the platform signs with |
| `FUNCTION_PORT` | `3012` | Port for the signed route only |
| `PORT` | `3002` | The demo UI + `/api/products` |
| `DB_PATH` | `products.db` | SQLite file (the wire script uses an absolute path) |
| `SHOPG41_TENANT` | — | Send `X-Tenant` instead of resolving by subdomain |

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — React frontend, SQLite API, and the signed `/function` route |
| `frontend.tsx` | React app — product form + list |
| `index.html` | Entry point with styles |
| `wire.ts` | Registers the data source + endpoint (local or remote), or `--undo`s it |
