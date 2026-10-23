# Storage + Functions Demo

Two capabilities in one app:
- **Storage** — upload an image to shopG41's R2/S3 storage and get a public URL
- **Functions** — register a "serverless" function and call it through a shopG41
  pipeline endpoint (HMAC-signed, no arbitrary code on the platform)

## What this demonstrates

1. **Function contract**: shopG41 `function` data sources ping your endpoint to
   verify connectivity (`{ type: "ping" }`)
2. **Passthrough**: a pipeline `function` step forwards `{ prev }` to your
   endpoint, signed with an `X-ShopG41-Signature` HMAC your function verifies
3. **Storage**: shopG41 uploads files to R2/S3 and serves them from a public URL

```
   This app (localhost:3005)
   ├── POST /ping       ← function data-source connection test
   ├── POST /function   ← HMAC-signed { prev } → order quote
   └── frontend (upload panel + function panel)
          │                       │
          ▼                       ▼
   shopG41 (localhost:3001)
   ├── data source "…Demo Server"      (function, url = /ping)
   ├── data source "…Passthrough"      (passthrough, url = /function)
   ├── pipeline GET /api/e/order-quote (function step)
   └── POST /api/admin/blog/upload     (stores image in R2)
```

## Run the demo

```bash
cd demos/storage-functions
bun install
bun run dev        # http://localhost:3005
```

## Connect to shopG41

While shopG41 runs on `:3001` with an API key (needs `write`/`admin` scope) and
R2 configured (already set in `shopG41/.env.local`):

```bash
SHOPG41_BASE_URL="http://demo.localhost:3001" \
SHOPG41_API_KEY="sk_..." \
  bun run wire
```

The script registers both data sources, publishes the pipeline, calls the
function through shopG41, and uploads a sample image to R2.

Then open http://localhost:3005 — upload any image from the panel, and press
"Call Function" to watch shopG41 forward a signed request to your function.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Bun server — function/ping handlers + upload proxy + pipeline call |
| `frontend.tsx` | React app — upload to R2 and call the function |
| `index.html` | Entry point with styles |
| `wire.ts` | Script to register data sources + endpoint and upload a sample image |
