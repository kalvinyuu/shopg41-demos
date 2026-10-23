# AI Capabilities Demo

Shows shopG41's **AI pipeline step** end-to-end: a SQLite product DB + an
OpenAI-compatible LLM, chained together by a pipeline endpoint.

## What this demonstrates

1. Your product data lives in a local SQLite DB (this demo)
2. You register it as a `sqlite` data source in shopG41
3. You register an LLM as a `function` data source (`{ url, apiKey }`)
4. You publish a pipeline endpoint: `query` → `ai` → `transform`
5. shopG41 queries your DB, sends the rows to the LLM, then JSONPath-transforms
   the reply into clean per-product marketing copy

```
   This app (localhost:3006)
   ├── SQLite products.db
   └── Mock LLM  POST /v1/chat/completions (OpenAI-compatible)
          │            │
          ▼            ▼
   shopG41 (localhost:3001)
   ├── data source "AI Demo Products"  (sqlite)
   ├── data source "AI Demo LLM"       (function)
   └── pipeline GET /api/e/ai-product-copy
         ├── step 1: query      → SELECT * FROM products
         ├── step 2: ai         → chat.completions(prompt + rows)
         └── step 3: transform  → JSONPath $.products + field whitelist
```

## Run the demo

```bash
cd demos/ai
bun install
bun run dev        # http://localhost:3006
```

The mock LLM responds deterministically — no network, no API key, no cost.

## Connect to shopG41

While your shopG41 dev server runs on `:3001` and you have an admin API key:

```bash
SHOPG41_BASE_URL="http://demo.localhost:3001" \
SHOPG41_API_KEY="sk_..." \
  bun run wire
```

> `SHOPG41_BASE_URL` uses the `demo` subdomain so shopG41 resolves a tenant.
> If you use plain `http://localhost:3001`, pass your tenant id/subdomain via
> `SHOPG41_TENANT="1"` and the script injects an `X-Tenant` header.

The script creates both data sources, publishes the pipeline endpoint, and
prints the generated copy.

## Use real AI instead of the mock

Set `OPENAI_API_KEY` on the demo server. The mock `/v1/chat/completions` route
then proxies to `https://api.openai.com/v1/chat/completions` — the pipeline
stays identical, only the model answers.

```bash
OPENAI_API_KEY="sk-..." bun run dev
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — SQLite products + mock LLM + shopG41 client |
| `frontend.tsx` | React app — add products, generate AI copy |
| `index.html` | Entry point with styles |
| `wire.ts` | Script to register data sources + publish the pipeline |
