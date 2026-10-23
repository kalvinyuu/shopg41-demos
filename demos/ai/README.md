# AI Capabilities Demo

Shows shopG41's **AI pipeline step** end-to-end: product rows + an
OpenAI-compatible LLM, chained together by a pipeline endpoint.

## What this demonstrates

1. Your product data lives in a local SQLite DB (this demo)
2. You expose those rows to shopG41 — a `sqlite` data source when the platform
   is on this machine, or a signed HTTPS `function` step when it is hosted
3. You register an LLM as a `function` data source (`{ url, apiKey }`)
4. You publish a pipeline endpoint: `query`/`function` → `ai` → `transform`
5. shopG41 reads your rows, sends them to the LLM, then JSONPath-transforms the
   reply into clean per-product marketing copy

```
   This app (localhost:3006 + 3013)
   ├── SQLite products.db
   ├── Mock LLM  POST /v1/chat/completions (OpenAI-compatible)
   └── signed     POST /function            (rows, for a hosted platform)
          │            │
          ▼            ▼
   shopG41
   ├── data source "AI Demo Products"  (sqlite locally, passthrough remotely)
   ├── data source "AI Demo LLM"       (function)
   └── pipeline GET /api/e/ai-product-copy
         ├── step 1: query      → SELECT * FROM products   (or the function step)
         ├── step 2: ai         → chat.completions(prompt + rows)
         └── step 3: transform  → JSONPath $.products + field whitelist
```

## Run the demo

```bash
cd demos/ai
bun install
bun run dev        # http://localhost:3006
```

The mock LLM responds deterministically — no network, no API key, no cost. It
also answers the platform's `ping` (an `X-ShopG41-Event: ping` POST) so the data
source test passes.

## Connect it

### Platform on this machine

```bash
SHOPG41_BASE_URL="http://demo.localhost:3001" \
SHOPG41_API_KEY="sk_..." \
  bun run wire --local
```

> `SHOPG41_BASE_URL` uses the `demo` subdomain so shopG41 resolves a tenant. With
> plain `http://localhost:3001`, pass your tenant id/subdomain via
> `SHOPG41_TENANT="1"` and the script injects an `X-Tenant` header.

### Platform hosted elsewhere

Both halves have to be reachable by the platform: the rows and the model.

```bash
cloudflared tunnel --url http://localhost:3013   # rows  → BACKEND_URL
cloudflared tunnel --url http://localhost:3006   # LLM   → LLM_URL

BACKEND_URL="https://<rows-tunnel>" \
LLM_URL="https://<llm-tunnel>" \
SHOPG41_BASE_URL="https://your-store.shopg41.com" \
SHOPG41_API_KEY="sk_..." \
  bun run wire
```

The rows step becomes a `function` step on a `passthrough` data source, and the
LLM data source stores the full `…/v1/chat/completions` URL (the platform would
otherwise append it a second time). Add a product locally and the next pipeline
call includes it.

```bash
bun run wire --undo   # remove both data sources and the endpoint
```

## Use real AI instead of the mock

Set `OPENAI_API_KEY` on the demo server. `/v1/chat/completions` then proxies to
`https://api.openai.com/v1/chat/completions` — the pipeline stays identical, only
the model answers. Or point the LLM data source straight at
`https://api.openai.com` (base URL, **not** `.../v1`) with a real key.

```bash
OPENAI_API_KEY="sk-..." bun run dev
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_URL` | — | Public URL serving `/function` (required for the remote shape) |
| `LLM_URL` | `http://localhost:3006` | Base URL of the LLM; the script stores `/v1/chat/completions` |
| `FUNCTION_SECRET` | `ai-demo-secret` | HMAC key the platform signs with |
| `FUNCTION_PORT` | `3013` | Port for the signed rows route only |
| `DB_PATH` | `<demo>/products.db` | SQLite file |
| `OPENAI_API_KEY` | — | Proxy to real OpenAI instead of the mock |
| `SHOPG41_TENANT` | — | Send `X-Tenant` instead of resolving by subdomain |

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — SQLite products, mock LLM, signed `/function`, shopG41 client |
| `frontend.tsx` | React app — add products, generate AI copy |
| `index.html` | Entry point with styles |
| `wire.ts` | Registers the data sources + pipeline (local or remote), or `--undo`s it |
