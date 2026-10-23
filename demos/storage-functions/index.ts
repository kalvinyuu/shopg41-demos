import { createHmac, timingSafeEqual } from "node:crypto"
import index from "./index.html"
import { ShopG41Client } from "../../packages/sdk/src/index"

const PORT = Number(process.env.PORT || 3005)
const SHARED_SECRET = process.env.FUNCTION_SECRET || "demo-function-secret"
const FUNCTION_URL = process.env.FUNCTION_URL || `http://localhost:${PORT}/function`
const PING_URL = process.env.PING_URL || `http://localhost:${PORT}/ping`

// ─────────────────────────────────────────────────────────────────────────────
// "Serverless function" — the standardized shopG41 function contract.
// shopG41 calls POST /function with { prev } and an HMAC signature.
// ─────────────────────────────────────────────────────────────────────────────
function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

function verifySignature(body: string, secret: string, received: string | null): boolean {
  if (!received) return false
  const expected = Buffer.from(sign(body, secret), "hex")
  const actual = Buffer.from(received, "hex")
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

async function handleFunction(req: Request): Promise<Response> {
  const body = await req.text()
  const signature = req.headers.get("x-shopg41-signature")
  const verified = verifySignature(body, SHARED_SECRET, signature)

  let prev: unknown = null
  try {
    prev = (JSON.parse(body || "{}") as { prev?: unknown }).prev ?? null
  } catch {
    prev = body
  }

  // A tiny "business function": build an order quote from the incoming payload.
  const subtotal = typeof (prev as Record<string, unknown>)?.subtotal === "number"
    ? (prev as { subtotal: number }).subtotal
    : 123.45
  const shipping = subtotal >= 50 ? 0 : 4.95
  const quote = {
    verified,
    service: "order-quote",
    received: prev,
    quote: {
      subtotal: Math.round(subtotal * 100) / 100,
      shipping,
      total: Math.round((subtotal + shipping) * 100) / 100,
      currency: "GBP",
    },
  }

  console.log(`[function] ${verified ? "HMAC verified" : "NO/INVALID signature"}`)
  return Response.json(quote)
}

// Ping handler for the `function` data-source connection test.
function handlePing(): Response {
  return Response.json({ ok: true, pong: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// shopG41 client — API key stays server-side, browsers never see it
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = process.env.SHOPG41_BASE_URL || "http://demo.localhost:3001"
const API_KEY = process.env.SHOPG41_API_KEY
const TENANT = process.env.SHOPG41_TENANT

function makeClient(): ShopG41Client {
  if (!API_KEY) throw new Error("Set SHOPG41_API_KEY=sk_... (see README)")
  const wrapFetch: typeof fetch | undefined = TENANT
    ? ((input: any, init?: any) =>
        fetch(input, {
          ...init,
          headers: { ...((init?.headers as Record<string, string>) ?? {}), "X-Tenant": TENANT },
        })) as typeof fetch
    : undefined
  return new ShopG41Client({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: wrapFetch })
}

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────
Bun.serve({
  routes: {
    "/": index,

    "/ping": {
      POST: handlePing,
    },

    "/function": {
      POST: handleFunction,
    },

    // Forward an image upload to shopG41 → R2 storage. Returns the public URL.
    "/api/upload": {
      POST: async (req) => {
        try {
          const form = await req.formData()
          const file = form.get("image")
          if (!(file instanceof File)) {
            return Response.json({ error: "Upload field 'image' is required" }, { status: 400 })
          }
          const client = makeClient()
          const fd = new FormData()
          fd.set("image", file, file.name)
          const res = await client.requestMultipart<{ success: boolean; url: string }>(
            "/api/admin/blog/upload",
            fd
          )
          return Response.json(res)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },

    // Call the pipeline endpoint that runs the function step through shopG41.
    "/api/call-function": {
      GET: async () => {
        try {
          const client = makeClient()
          const result = await client.endpoints.call<unknown>("/order-quote")
          return Response.json(result)
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 })
        }
      },
    },
  },

  development: { hmr: true, console: true },
  port: PORT,
})

console.log(`Storage + Functions Demo running at http://localhost:${PORT}`)
console.log(`Function endpoint: ${FUNCTION_URL}`)
console.log(`Ping endpoint:     ${PING_URL}`)
console.log(`Shared secret:     ${SHARED_SECRET}`)
